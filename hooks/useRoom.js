// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

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
    
    // 👇 FIX: `handleUserLeft` 로직 수정
    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      
      // 1. peersRef에서 해당 peer를 즉시 찾습니다.
      const peerToRemove = peersRef.current.find(p => p.peerID === removedUserId);
      
      // 2. peer 객체를 즉시 파괴하여 추가적인 signal 처리를 막습니다.
      if (peerToRemove && !peerToRemove.peer.destroyed) {
          peerToRemove.peer.destroy();
      }

      // 3. React 상태 업데이트를 예약하여 화면에서 제거합니다.
      setPeers(currentPeers => currentPeers.filter(p => p.peerID !== removedUserId));
    };
    
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName });
    onDisconnect(currentUserRef).remove();
    
    onChildAdded(usersRef, handleUserJoined);
    onChildRemoved(usersRef, handleUserLeft);
    onChildAdded(signalsRef, handleSignal);

    return () => {
      remove(currentUserRef);
      get(usersRef).then((snapshot) => {
        if (!snapshot.exists()) {
          remove(roomRef);
        }
      });
      peersRef.current.forEach(({ peer }) => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
      setPeers([]);
      peersRef.current = [];
    };
  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}