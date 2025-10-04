// hooks/useWebRTC.js
import { useCallback } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN 서버가 있다면 여기에 추가하세요.
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
      // 👇 FIX: senderDisplayName 추가
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });
    
    peer.on('stream', () => console.log(`[${user.displayName}] Received stream from ${otherUserID}`));
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
      // 👇 FIX: senderDisplayName 추가
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });

    peer.on('stream', () => console.log(`[${user.displayName}] Received stream from ${senderId}`));
    peer.on('connect', () => console.log(`Connection established with ${senderId}`));
    peer.on('error', (err) => console.error(`Connection error with ${senderId}:`, err));

    peer.signal(incomingSignal);
    return peer;
  }, [user, roomID]);
  
  return { createPeer, addPeer };
}