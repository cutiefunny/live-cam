// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child, off, push, runTransaction } from 'firebase/database';
import { database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useRoom(roomID, user, localStream, createPeer, addPeer, iceServersReady, settings, isCreator) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const callStateRef = useRef({});
  const coinDeductionIntervalsRef = useRef({});
  const isCreatorRef = useRef(isCreator);
  const { setGiftAnimation } = useAppStore();

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
    const giftsRef = child(roomRef, 'gifts');

    const creatorRef = ref(database, `creators/${user.uid}`);
    if (isCreator) {
        set(child(creatorRef, 'status'), 'busy');
        onDisconnect(child(creatorRef, 'status')).set('offline');
    }
    
    const handleGift = (snapshot) => {
        const giftData = snapshot.val();
        setGiftAnimation(giftData);
        remove(snapshot.ref);
    };

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
            return;
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
    
    // ✨ [추가] peer의 remoteStream을 상태에 업데이트하는 함수
    const updatePeerStream = (peerID, stream) => {
      setPeers(currentPeers =>
        currentPeers.map(p =>
          p.peerID === peerID ? { ...p, remoteStream: stream } : p
        )
      );
    };

    const setupPeerListeners = (peer, peerID, peerData) => {
      // ✨ [추가] 스트림 이벤트 리스너를 여기서 바로 등록
      peer.on('stream', (stream) => {
        console.log(`[Room] Received stream from ${peerID}`);
        updatePeerStream(peerID, stream);
      });
      
      peer.on('connect', async () => {
        console.log(`Call connected with ${peerID}. Recording start time.`);
        callStateRef.current[peerID] = {
            startTime: Date.now(),
            peerData: peerData
        };
        
        if (!isCreator) {
          console.log(`[Coin] Initiating coin logic for call with ${peerID}. This user is the caller.`);

          let success = true;
          if (costToStart > 0) {
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
            
            if (!isCreator) {
              const historyRef = ref(database, 'call_history');
              
              const callRecord = {
                  callerId: user.uid,
                  callerName: user.displayName,
                  calleeId: peerID,
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
            // ✨ [수정] remoteStream 속성을 null로 초기화하여 추가
            return [...currentPeers, { peerID: otherUserId, peer, remoteStream: null, ...userData }];
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
              // ✨ [수정] remoteStream 속성을 null로 초기화하여 추가
              return [...currentPeers, { peerID: senderId, peer, remoteStream: null, ...peerData }];
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
    const giftListener = onChildAdded(giftsRef, handleGift);

    return () => {
      off(usersRef, 'child_added', userJoinedListener);
      off(usersRef, 'child_removed', userLeftListener);
      off(signalsRef, 'child_added', signalListener);
      off(giftsRef, 'child_added', giftListener);
      remove(currentUserRef);
      
      Object.values(coinDeductionIntervalsRef.current).forEach(clearInterval);
      coinDeductionIntervalsRef.current = {};

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
  }, [roomID, user, localStream, createPeer, addPeer, iceServersReady, settings, isCreator, setGiftAnimation]);
  
  return { peers };
}