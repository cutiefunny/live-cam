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
          const newPeer = { peerID: otherUserId, peer, photoURL: userData.photoURL, displayName: userData.displayName };
          return [...currentPeers, newPeer];
        });
      }
    };

    const handleSignal = (snapshot) => {
      const { senderId, signal, senderPhotoURL, senderDisplayName } = snapshot.val();
      if (senderId === user.uid) return;

      const existingPeer = peersRef.current.find(p => p.peerID === senderId);

      if (existingPeer) {
        if (!existingPeer.peer.destroyed) {
          existingPeer.peer.signal(signal);
        }
      } else {
        if (signal.type === 'offer') {
          setPeers(currentPeers => {
            if (currentPeers.some(p => p.peerID === senderId)) {
              return currentPeers;
            }
            const peer = addPeer(signal, senderId, localStream);
            const newPeer = { peerID: senderId, peer, photoURL: senderPhotoURL, displayName: senderDisplayName };
            return [...currentPeers, newPeer];
          });
        }
      }
      remove(snapshot.ref);
    };
    
    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      setPeers(currentPeers => {
          const peerToRemove = currentPeers.find(p => p.peerID === removedUserId);
          if (peerToRemove && !peerToRemove.peer.destroyed) {
              peerToRemove.peer.destroy();
          }
          return currentPeers.filter(p => p.peerID !== removedUserId);
      });
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
        if (!peer.destroyed) {
          peer.destroy();
        }
      });
      setPeers([]);
      peersRef.current = [];
    };
  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}