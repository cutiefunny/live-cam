// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  // 👇 FIX: 중복 생성을 막기 위한 새로운 함수
  // 이 함수는 상태 업데이트 안에서 호출되어 항상 최신 상태를 보장합니다.
  const addPeerConnection = (currentPeers, peerData) => {
    const { peerID, peer, photoURL, displayName } = peerData;
    if (currentPeers.some(p => p.peerID === peerID)) {
      return currentPeers; // 이미 존재하면 아무것도 하지 않음
    }
    const newPeer = { peerID, peer, photoURL, displayName };
    peersRef.current = [...currentPeers, newPeer];
    return [...currentPeers, newPeer];
  };

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
        const peer = createPeer(otherUserId, localStream);
        setPeers(currentPeers => addPeerConnection(currentPeers, {
          peerID: otherUserId,
          peer,
          photoURL: userData.photoURL,
          displayName: userData.displayName,
        }));
      }
    };
    
    const handleSignal = (snapshot) => {
      const { senderId, signal, senderPhotoURL, senderDisplayName } = snapshot.val();
      if (senderId === user.uid) return;

      const existingPeer = peersRef.current.find(p => p.peerID === senderId);

      if (existingPeer) {
        existingPeer.peer.signal(signal);
      } else {
        // 👇 FIX: 복잡한 ID 비교 대신, 상대방이 먼저 연결을 시작한 경우
        // (즉, 아직 내게 peer가 없는 경우) 응답하는 peer를 생성합니다.
        const peer = addPeer(signal, senderId, localStream);
        setPeers(currentPeers => addPeerConnection(currentPeers, {
          peerID: senderId,
          peer,
          photoURL: senderPhotoURL,
          displayName: senderDisplayName,
        }));
      }
      remove(snapshot.ref);
    };

    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      setPeers(currentPeers => {
        const peerToRemove = peersRef.current.find(p => p.peerID === removedUserId);
        if (peerToRemove) {
          peerToRemove.peer.destroy();
        }
        const newPeers = currentPeers.filter(p => p.peerID !== removedUserId);
        peersRef.current = newPeers;
        return newPeers;
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
      peersRef.current.forEach(p => p.peer.destroy());
      setPeers([]);
      peersRef.current = [];
    };

  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}