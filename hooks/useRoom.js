// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
// 👇 onDisconnect, get, child를 import에 추가합니다.
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  useEffect(() => {
    if (!user || !roomID) return;

    const roomRef = ref(database, `rooms/${roomID}`); // 방 전체에 대한 참조
    const usersRef = child(roomRef, 'users'); // 방 안의 'users' 노드 참조
    const currentUserRef = child(usersRef, user.uid); // 현재 사용자에 대한 참조
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);

    const handleUserJoined = (snapshot) => {
        const otherUserId = snapshot.key;
        if (otherUserId === user.uid || peersRef.current.some(p => p.peerID === otherUserId)) {
            return;
        }
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
            if (user.uid < senderId) {
                const peer = addPeer(signal, senderId, localStream);
                const peerRefObj = { peerID: senderId, peer, photoURL: senderPhotoURL, displayName: senderDisplayName };
                peersRef.current.push(peerRefObj);
                setPeers(prev => [...prev, peerRefObj]);
            }
        }
        remove(snapshot.ref);
    };
    
    // 1. 현재 사용자 정보를 DB에 등록합니다.
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName });
    
    // 👇 FIX: 2. 사용자의 연결이 끊어지면 DB에서 자동으로 제거되도록 예약합니다.
    onDisconnect(currentUserRef).remove();
    
    // 다른 사용자들의 입장/퇴장/신호를 감지하는 리스너 설정
    onChildAdded(usersRef, handleUserJoined);
    onChildRemoved(usersRef, handleUserLeft);
    onChildAdded(signalsRef, handleSignal);

    // 컴포넌트 언마운트 시(사용자가 방을 나갈 때) 실행되는 정리 함수
    return () => {
      // 3. 현재 사용자를 목록에서 제거합니다. (정상적인 퇴장 처리)
      remove(currentUserRef);

      // 4. 방에 다른 사용자가 남아있는지 확인합니다.
      get(usersRef).then((snapshot) => {
        // 👇 FIX: 5. 만약 방에 아무도 없다면 (users 노드가 비어있다면) 방 전체를 삭제합니다.
        if (!snapshot.exists()) {
          remove(roomRef);
          console.log(`Room ${roomID} is empty and has been deleted.`);
        }
      });
      
      // WebRTC 연결 정리
      peersRef.current.forEach(p => p.peer.destroy());
      setPeers([]);
      peersRef.current = [];
    };

  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}