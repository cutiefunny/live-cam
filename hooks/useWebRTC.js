// hooks/useWebRTC.js
import { useCallback, useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useWebRTC(user, roomID) {
  const [iceServers, setIceServers] = useState([]);
  const iceServersRef = useRef(iceServers);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

  useEffect(() => {
    console.log('[WebRTC] Hook mounted. Fetching ICE servers...');
    const fetchIceServers = async () => {
      try {
        const response = await fetch('/api/turn');
        if (!response.ok) {
          throw new Error('Failed to fetch ICE servers');
        }
        const data = await response.json();
        console.log('[WebRTC] Successfully fetched ICE servers from Twilio:', data.iceServers);
        setIceServers(data.iceServers);
      } catch (error) {
        console.error("[WebRTC] Could not fetch ICE servers. Using STUN only.", error);
        const stunServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
        console.log('[WebRTC] Falling back to STUN servers:', stunServers);
        setIceServers(stunServers);
      }
    };

    fetchIceServers();
  }, []);

  const createPeer = useCallback((otherUserID, stream) => {
    console.log(`[WebRTC] createPeer called for user: ${otherUserID}`);
    if (iceServersRef.current.length === 0) {
        console.warn('[WebRTC] createPeer aborted: ICE servers not ready.');
        return null;
    }
    console.log('[WebRTC] Creating peer with ICE servers:', iceServersRef.current);

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: { iceServers: iceServersRef.current },
    });

    peer.on('signal', (signal) => {
      console.log(`[WebRTC] 'signal' event (offer) for ${otherUserID}`);
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${otherUserID}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });
    
    peer.on('connect', () => console.log(`[WebRTC] 'connect' event: Connection established with ${otherUserID}`));
    peer.on('stream', (remoteStream) => console.log(`[WebRTC] 'stream' event: Received remote stream from ${otherUserID}`, remoteStream));
    peer.on('close', () => console.log(`[WebRTC] 'close' event: Connection closed with ${otherUserID}`));
    peer.on('error', (err) => console.error(`[WebRTC] 'error' event with ${otherUserID}:`, err));

    return peer;
  }, [user, roomID]);

  // ✨ 해결책: addPeer 로직 수정
  const addPeer = useCallback((incomingSignal, senderId, stream) => {
    console.log(`[WebRTC] addPeer called for user: ${senderId}`);
    if (iceServersRef.current.length === 0) {
      console.warn('[WebRTC] addPeer aborted: ICE servers not ready.');
      return null;
    }
    console.log('[WebRTC] Adding peer with ICE servers:', iceServersRef.current);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      // ✨ Receiver는 생성자에서 stream을 추가하지 않습니다.
      config: { iceServers: iceServersRef.current },
    });

    peer.on('signal', (signal) => {
      console.log(`[WebRTC] 'signal' event (answer) for ${senderId}`);
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${senderId}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });

    peer.on('connect', () => console.log(`[WebRTC] 'connect' event: Connection established with ${senderId}`));
    peer.on('stream', (remoteStream) => console.log(`[WebRTC] 'stream' event: Received remote stream from ${senderId}`, remoteStream));
    peer.on('close', () => console.log(`[WebRTC] 'close' event: Connection closed with ${senderId}`));
    peer.on('error', (err) => console.error(`[WebRTC] 'error' event with ${senderId}:`, err));

    // 먼저 상대방의 offer 시그널을 처리합니다.
    peer.signal(incomingSignal);

    // ✨ 그 다음에 자신의 스트림을 추가하여 재협상(re-negotiation)을 유도합니다.
    if (stream) {
      peer.addStream(stream);
    }
    
    return peer;
  }, [user, roomID]);
  
  return { createPeer, addPeer, iceServersReady: iceServers.length > 0 };
}