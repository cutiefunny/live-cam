// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  // peersRef가 항상 최신 상태를 참조하도록 동기화합니다.
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (!user || !roomID) return;

    const roomRef = ref(database, `rooms/${roomID}`);
    const usersRef = child(roomRef, 'users');
    const currentUserRef = child(usersRef, user.uid);
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);

    // --- 새로운 연결 로직 ---
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
      if (senderId === user.uid) return;

      const peerToSignal = peersRef.current.find(p => p.peerID === senderId);

      if (peerToSignal) {
        // 이미 연결 객체가 존재하면, 신호만 전달합니다.
        // 파괴된 peer에 신호를 보내려 할 때 발생하는 오류를 막습니다.
        if (!peerToSignal.peer.destroyed) {
          peerToSignal.peer.signal(signal);
        }
      } else {
        // 연결 객체가 없고, 내가 응답자(Receiver) 역할일 때만 새로 생성합니다.
        // Initiator(ID가 큰 쪽)가 보낸 첫 'offer' 신호가 여기에 해당합니다.
        if (user.uid < senderId) {
          setPeers(currentPeers => {
            if (currentPeers.some(p => p.peerID === senderId)) {
              return currentPeers; // 안전장치: 상태 업데이트 직전 다시 확인
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
    // --- 로직 종료 ---
    
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