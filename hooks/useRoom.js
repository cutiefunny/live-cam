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

    // ✨ [제거] Firestore로 통합되었으므로 중복되는 로직을 제거합니다.
    
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

        // ✨ [제거] 코인 차감 로직은 page.js로 통합되었습니다.
      });

      peer.on('close', () => {
        console.log(`Call with ${peerID} closed.`);

        if (coinDeductionIntervalsRef.current[peerID]) {
          clearInterval(coinDeductionIntervalsRef.current[peerID]);
          delete coinDeductionIntervalsRef.current[peerID];
        }
        
        // ✨ [제거] 통화 기록 저장은 page.js로 통합되었습니다.
        if (callStateRef.current[peerID]) {
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