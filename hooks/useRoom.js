// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  // peersRef가 항상 최신 상태의 peers를 참조하도록 동기화합니다.
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (!user || !roomID) return;

    const roomRef = ref(database, `rooms/${roomID}`);
    const usersRef = child(roomRef, 'users');
    const currentUserRef = child(usersRef, user.uid);
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);

    const handleUserJoined = (snapshot) => {
      const otherUserId = snapshot.key;
      const userData = snapshot.val();
      if (otherUserId === user.uid) return;

      // 규칙: ID가 더 큰 사용자가 항상 연결을 시작(Initiator)합니다.
      if (user.uid > otherUserId) {
        setPeers(currentPeers => {
          if (currentPeers.some(p => p.peerID === otherUserId)) {
            return currentPeers;
          }
          const peer = createPeer(otherUserId, localStream);
          const newPeerObj = {
            peerID: otherUserId,
            peer,
            photoURL: userData.photoURL,
            displayName: userData.displayName,
          };
          return [...currentPeers, newPeerObj];
        });
      }
    };

    const handleSignal = (snapshot) => {
      const { senderId, signal, senderPhotoURL, senderDisplayName } = snapshot.val();
      if (senderId === user.uid) {
        remove(snapshot.ref);
        return;
      };

      const peerToSignal = peersRef.current.find(p => p.peerID === senderId);

      if (peerToSignal) {
        if (peerToSignal.peer && !peerToSignal.peer.destroyed) {
          peerToSignal.peer.signal(signal);
        }
      } else {
        // 연결 객체가 없고, 내가 응답자(Receiver) 역할일 때만 새로 생성합니다.
        if (signal.type === 'offer' && user.uid < senderId) {
          setPeers(currentPeers => {
            if (currentPeers.some(p => p.peerID === senderId)) {
              return currentPeers;
            }
            const peer = addPeer(signal, senderId, localStream);
            const newPeerObj = {
              peerID: senderId,
              peer,
              photoURL: senderPhotoURL,
              displayName: senderDisplayName,
            };
            return [...currentPeers, newPeerObj];
          });
        }
      }
      remove(snapshot.ref);
    };

    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      
      const peerToRemove = peersRef.current.find(p => p.peerID === removedUserId);
      
      if (peerToRemove && !peerToRemove.peer.destroyed) {
          peerToRemove.peer.destroy();
      }

      setPeers(currentPeers => currentPeers.filter(p => p.peerID !== removedUserId));
    };
    
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName });
    onDisconnect(currentUserRef).remove();
    
    // Firebase 리스너를 변수에 할당하여 나중에 제거할 수 있도록 합니다.
    const userJoinedListener = onChildAdded(usersRef, handleUserJoined);
    const userLeftListener = onChildRemoved(usersRef, handleUserLeft);
    const signalListener = onChildAdded(signalsRef, handleSignal);

    // 컴포넌트가 사라질 때 실행되는 정리(cleanup) 함수
    return () => {
      // Firebase 리스너를 명시적으로 제거합니다.
      usersRef.off('child_added', userJoinedListener);
      usersRef.off('child_removed', userLeftListener);
      signalsRef.off('child_added', signalListener);

      remove(currentUserRef);
      
      peersRef.current.forEach(({ peer }) => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
      setPeers([]);
      peersRef.current = [];

      // PWA의 재-렌더링 경쟁 상태를 막기 위해 지연 시간을 두고 방 삭제 로직을 실행합니다.
      setTimeout(() => {
        get(usersRef).then((snapshot) => {
          if (!snapshot.exists()) {
            remove(roomRef);
            console.log(`Room ${roomID} was empty and has been deleted.`);
          }
        });
      }, 500); 
    };
  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}