// hooks/useRoom.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  useEffect(() => {
    if (!user || !roomID) return;

    const usersRef = ref(database, `rooms/${roomID}/users`);
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);

    const handleUserJoined = (snapshot) => {
      const otherUserId = snapshot.key;
      if (otherUserId === user.uid) return;
      
      // 👇 FIX: 이미 연결 중인 사용자인지 확인하여 중복 생성을 방지합니다.
      if (peersRef.current.some(p => p.peerID === otherUserId)) return;

      const userData = snapshot.val();
      if (user.uid > otherUserId) {
        const peer = createPeer(otherUserId, localStream);
        const peerRefObj = { peerID: otherUserId, peer, photoURL: userData.photoURL, displayName: userData.displayName };
        peersRef.current.push(peerRefObj);
        setPeers(prev => [...prev, peerRefObj]);
      }
    };

    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      const item = peersRef.current.find(p => p.peerID === removedUserId);
      if (item) item.peer.destroy();
      const newPeers = peersRef.current.filter(p => p.peerID !== removedUserId);
      peersRef.current = newPeers;
      setPeers(newPeers);
    };

    const handleSignal = (snapshot) => {
      const { senderId, signal, senderPhotoURL, senderDisplayName } = snapshot.val();
      if (senderId === user.uid) return;

      const item = peersRef.current.find(p => p.peerID === senderId);
      if (item) {
        item.peer.signal(signal);
      } else {
        const peer = addPeer(signal, senderId, localStream);
        const peerRefObj = { peerID: senderId, peer, photoURL: senderPhotoURL, displayName: senderDisplayName };
        peersRef.current.push(peerRefObj);
        setPeers(prev => [...prev, peerRefObj]);
      }
      remove(snapshot.ref);
    };

    const currentUserRef = ref(database, `rooms/${roomID}/users/${user.uid}`);
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName });

    onChildAdded(usersRef, handleUserJoined);
    onChildRemoved(usersRef, handleUserLeft);
    onChildAdded(signalsRef, handleSignal);

    return () => {
      if (currentUserRef) {
          remove(currentUserRef);
      }
      peersRef.current.forEach(p => p.peer.destroy());
      setPeers([]);
      peersRef.current = [];
    };

  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}