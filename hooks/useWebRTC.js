// hooks/useWebRTC.js
import { useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

// STUN 서버와 TURN 서버를 함께 설정합니다.
const ICE_SERVERS = {
  iceServers: [
    // STUN 서버는 그대로 사용합니다.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // 👇 FIX: 여기에 개발자님의 TURN 서버 정보를 추가하세요.
    /*
    {
      urls: 'turn:YOUR_TURN_SERVER_ADDRESS:PORT',
      username: 'YOUR_USERNAME',
      credential: 'YOUR_PASSWORD',
    },
    */
  ],
};

export function useWebRTC(user, roomID) {
  // ... (createPeer, addPeer 함수는 변경 사항 없습니다) ...
  const createPeer = useCallback((otherUserID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: ICE_SERVERS,
    });

    peer.on('signal', (signal) => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${otherUserID}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL });
    });
    
    peer.on('connect', () => console.log(`Connection established with ${otherUserID}`));
    peer.on('error', (err) => console.error(`Connection error with ${otherUserID}:`, err));

    return peer;
  }, [user, roomID]);

  const addPeer = useCallback((incomingSignal, senderId, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: ICE_SERVERS,
    });

    peer.on('signal', (signal) => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${senderId}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL });
    });
    
    peer.on('connect', () => console.log(`Connection established with ${senderId}`));
    peer.on('error', (err) => console.error(`Connection error with ${senderId}:`, err));

    peer.signal(incomingSignal);
    return peer;
  }, [user, roomID]);
  
  return { createPeer, addPeer };
}