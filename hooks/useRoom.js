// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child, off, push, runTransaction } from 'firebase/database';
import { database } from '@/lib/firebase';

// ✨ [수정] isCreator prop을 전달받도록 변경
export function useRoom(roomID, user, localStream, createPeer, addPeer, iceServersReady, settings, isCreator) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const callStateRef = useRef({});
  const coinDeductionIntervalsRef = useRef({});
  const isCreatorRef = useRef(isCreator); // ✨ [추가] cleanup 함수에서 isCreator 값을 참조하기 위한 ref

  useEffect(() => {
    isCreatorRef.current = isCreator;
  }, [isCreator]);

  useEffect(() => {
    peersRef.current = peers;
    console.log('[Room] Peers state updated. Current peer IDs:', peers.map(p => p.peerID));
  }, [peers]);

  useEffect(() => {
    if (!user || !roomID || !localStream || !iceServersReady || !settings) {
      console.log('[Room] Main useEffect skipped. Conditions not met:', { hasUser: !!user, hasRoomID: !!roomID, hasLocalStream: !!localStream, iceServersReady, hasSettings: !!settings });
      return;
    }

    console.log('[Room] Main useEffect running. Setting up Firebase listeners for room:', roomID);
    const { costPerMinute, creatorShareRate, costToStart } = settings;

    const roomRef = ref(database, `rooms/${roomID}`);
    const usersRef = child(roomRef, 'users');
    const currentUserRef = child(usersRef, user.uid);
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);
    
    // ✨ [수정] isCreator prop을 직접 사용하여 크리에이터 상태 설정
    const creatorRef = ref(database, `creators/${user.uid}`);
    if (isCreator) {
        set(child(creatorRef, 'status'), 'busy');
        onDisconnect(child(creatorRef, 'status')).set('offline');
    }

    const payoutToCreator = (creatorId, fromUserId, amount) => {
      const creatorCoinRef = ref(database, `users/${creatorId}/coins`);
      runTransaction(creatorCoinRef, (currentCoins) => {
        return (currentCoins || 0) + amount;
      }).then(({ committed }) => {
        if (committed) {
          console.log(`[Coin] Successfully paid out ${amount} coins to creator ${creatorId}.`);
          
          get(ref(database, `users/${creatorId}`)).then(snapshot => {
            const creatorData = snapshot.val() || {};
            const coinHistoryRef = ref(database, 'coin_history');
            push(coinHistoryRef, {
              userId: creatorId,
              userName: creatorData.displayName || 'Creator',
              userEmail: creatorData.email || 'N/A',
              type: 'earn',
              amount: amount,
              timestamp: Date.now(),
              description: `Video call with ${fromUserId}`
            });
          });
        }
      });
    };

    const deductCoin = (userId, peerId, amount, description) => {
      return new Promise((resolve) => {
        const userCoinRef = ref(database, `users/${userId}/coins`);
        runTransaction(userCoinRef, (currentCoins) => {
          if (currentCoins === null || currentCoins < amount) {
            return; // 트랜잭션 중단 (잔액 부족)
          }
          return currentCoins - amount;
        }).then(({ committed }) => {
          if (committed) {
            console.log(`[Coin] Successfully deducted ${amount} coins from ${userId}.`);
            
            if (description !== '통화 시작') {
              const payoutAmount = Math.floor(costPerMinute * (creatorShareRate / 100));
              payoutToCreator(peerId, userId, payoutAmount);
            }

            const coinHistoryRef = ref(database, 'coin_history');
            push(coinHistoryRef, {
              userId: userId,
              userName: user.displayName,
              userEmail: user.email,
              type: 'use',
              amount: amount,
              timestamp: Date.now(),
              description: description === '통화 시작' ? `Video call with ${peerId}` : description
            });
            resolve(true);
          } else {
            console.log(`[Coin] Failed to deduct coins for ${userId}. Not enough coins.`);
            resolve(false);
          }
        });
      });
    };
    
    const setupPeerListeners = (peer, peerID, peerData) => {
      peer.on('connect', async () => {
        console.log(`Call connected with ${peerID}. Recording start time.`);
        callStateRef.current[peerID] = {
            startTime: Date.now(),
            peerData: peerData
        };
        
        // ✨ [수정] initiator 대신, 크리에이터가 '아닌' 사용자가 코인 로직을 시작하도록 변경
        if (!isCreator) {
          console.log(`[Coin] Initiating coin logic for call with ${peerID}. This user is the caller.`);

          let success = true;
          if (costToStart > 0) {
            // `user`는 현재 사용자(발신자), `peerID`는 상대방(수신자)
            success = await deductCoin(user.uid, peerID, costToStart, '통화 시작');
          }

          if (!success) {
            console.log(`[Coin] Initial charge failed. Terminating call with ${peerID}.`);
            peer.destroy();
            return;
          }
          
          const intervalId = setInterval(async () => {
            const minuteSuccess = await deductCoin(user.uid, peerID, costPerMinute, `Video call minute charge`);
            if (!minuteSuccess) {
              console.log(`[Coin] Per-minute charge failed. Terminating call with ${peerID}.`);
              peer.destroy();
            }
          }, 60000);
          
          coinDeductionIntervalsRef.current[peerID] = intervalId;
        }
      });

      peer.on('close', () => {
        console.log(`Call with ${peerID} closed. Saving to history.`);

        if (coinDeductionIntervalsRef.current[peerID]) {
          clearInterval(coinDeductionIntervalsRef.current[peerID]);
          delete coinDeductionIntervalsRef.current[peerID];
          console.log(`[Coin] Stopped coin deduction for call with ${peerID}.`);
        }
        
        const callInfo = callStateRef.current[peerID];
        if (callInfo && callInfo.startTime) {
            const duration = Date.now() - callInfo.startTime;
            
            // ✨ [수정] initiator 대신, 크리에이터가 '아닌' 사용자가 통화 기록을 남기도록 변경
            if (!isCreator) {
              const historyRef = ref(database, 'call_history');
              
              const callRecord = {
                  callerId: user.uid, // `user`는 현재 사용자, 즉 발신자
                  callerName: user.displayName,
                  calleeId: peerID, // `peerID`는 상대방, 즉 수신자
                  calleeName: callInfo.peerData.displayName,
                  roomId: roomID,
                  timestamp: callInfo.startTime,
                  duration: duration
              };
              push(historyRef, callRecord);
              console.log('[Room] Call history saved by caller.');
            }
            delete callStateRef.current[peerID];
        }
      });
    };

    const handleUserJoined = (snapshot) => {
      const otherUserId = snapshot.key;
      const userData = snapshot.val();
      if (otherUserId === user.uid) return;

      if (user.uid > otherUserId) {
        const peer = createPeer(otherUserId, localStream);
        if(peer) {
          setupPeerListeners(peer, otherUserId, userData);
          setPeers(currentPeers => {
            if (currentPeers.some(p => p.peerID === otherUserId)) return currentPeers;
            return [...currentPeers, { peerID: otherUserId, peer, ...userData }];
          });
        }
      }
    };

    const handleSignal = (snapshot) => {
      const { senderId, signal, senderPhotoURL, senderDisplayName } = snapshot.val();
      if (senderId === user.uid) { remove(snapshot.ref); return; };

      const peerToSignal = peersRef.current.find(p => p.peerID === senderId);
      if (peerToSignal) {
        if (peerToSignal.peer && !peerToSignal.peer.destroyed) {
          peerToSignal.peer.signal(signal);
        }
      } else {
        if (signal.type === 'offer' && user.uid < senderId) {
          const peer = addPeer(signal, senderId, localStream);
          if (peer) {
            const peerData = { photoURL: senderPhotoURL, displayName: senderDisplayName };
            setupPeerListeners(peer, senderId, peerData);
            setPeers(currentPeers => {
              if (currentPeers.some(p => p.peerID === senderId)) return currentPeers;
              return [...currentPeers, { peerID: senderId, peer, ...peerData }];
            });
          }
        }
      }
      remove(snapshot.ref);
    };

    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      const peerToRemove = peersRef.current.find(p => p.peerID === removedUserId);
      if (peerToRemove?.peer && !peerToRemove.peer.destroyed) {
          peerToRemove.peer.destroy();
      }
      setPeers(currentPeers => currentPeers.filter(p => p.peerID !== removedUserId));
    };
    
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName, email: user.email });
    
    const userJoinedListener = onChildAdded(usersRef, handleUserJoined);
    const userLeftListener = onChildRemoved(usersRef, handleUserLeft);
    const signalListener = onChildAdded(signalsRef, handleSignal);

    return () => {
      off(usersRef, 'child_added', userJoinedListener);
      off(usersRef, 'child_removed', userLeftListener);
      off(signalsRef, 'child_added', signalListener);
      remove(currentUserRef);
      
      Object.values(coinDeductionIntervalsRef.current).forEach(clearInterval);
      coinDeductionIntervalsRef.current = {};

      // ✨ [수정] isCreatorRef의 현재 값을 사용하여 크리에이터 상태 복원
      if (isCreatorRef.current) {
          onDisconnect(child(creatorRef, 'status')).cancel();
          set(child(creatorRef, 'status'), 'online');
      }
      
      peersRef.current.forEach(({ peer }) => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
      setPeers([]);
      peersRef.current = [];

      setTimeout(() => {
        get(usersRef).then((snapshot) => {
          if (!snapshot.exists()) {
            remove(roomRef);
          }
        });
      }, 5000); 
    };
  }, [roomID, user, localStream, createPeer, addPeer, iceServersReady, settings, isCreator]); // ✨ [수정] isCreator를 의존성 배열에 추가
  
  return { peers };
}