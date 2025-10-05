// hooks/useWebRTC.js
import { useCallback } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

// 👇 FIX: Agora에서 제공하는 STUN 서버 주소로 교체합니다.
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Agora의 STUN 서버는 여러 개를 동시에 사용하는 것을 권장합니다.
    { urls: "stun:stun.agora.io:3478" },
    { urls: "stun:stun2.agora.io:3478" },
    { urls: "stun:stun3.agora.io:3478" },
    { urls: "stun:stun4.agora.io:3478" },
  ],
};

export function useWebRTC(user, roomID) {
  const createPeer = useCallback((otherUserID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: ICE_SERVERS,
    });

    peer.on('signal', (signal) => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${otherUserID}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });
    
    peer.on('connect', () => console.log(`[${user.displayName}] Connection established with ${otherUserID}`));
    peer.on('error', (err) => console.error(`[${user.displayName}] Connection error with ${otherUserID}:`, err));

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
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });

    peer.on('connect', () => console.log(`[${user.displayName}] Connection established with ${senderId}`));
    peer.on('error', (err) => console.error(`[${user.displayName}] Connection error with ${senderId}:`, err));

    peer.signal(incomingSignal);
    return peer;
  }, [user, roomID]);
  
  return { createPeer, addPeer };
}