// hooks/useWebRTC.js
import { useCallback, useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore'; // ✨ [추가]

export function useWebRTC(user, roomID) {
  const [iceServers, setIceServers] = useState([]);
  const iceServersRef = useRef(iceServers);
  const showToast = useAppStore((state) => state.showToast); // ✨ [추가]

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
        showToast('TURN 서버 연결에 실패했습니다. P2P 연결 품질이 저하될 수 있습니다.', 'warn');
        const stunServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
        console.log('[WebRTC] Falling back to STUN servers:', stunServers);
        setIceServers(stunServers);
      }
    };

    fetchIceServers();
  }, [showToast]);

  const createPeer = useCallback((otherUserID, stream) => {
    console.log(`[WebRTC] createPeer called for user: ${otherUserID}`);
    if (iceServersRef.current.length === 0) {
        console.warn('[WebRTC] createPeer aborted: ICE servers not ready.');
        return null;
    }
    console.log('[WebRTC] Creating peer with ICE servers:', iceServersRef.current);

    try {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        config: { iceServers: iceServersRef.current },
      });
      
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });

      peer.on('signal', (signal) => {
        console.log(`[WebRTC] 'signal' event (offer) for ${otherUserID}`);
        const signalRef = push(ref(database, `rooms/${roomID}/signals/${otherUserID}`));
        set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
      });
      
      peer.on('connect', () => console.log(`[WebRTC] 'connect' event: Connection established with ${otherUserID}`));
      peer.on('stream', (remoteStream) => console.log(`[WebRTC] 'stream' event: Received remote stream from ${otherUserID}`, remoteStream));
      peer.on('close', () => console.log(`[WebRTC] 'close' event: Connection closed with ${otherUserID}`));
      peer.on('error', (err) => {
        console.error(`[WebRTC] 'error' event with ${otherUserID}:`, err);
        showToast('연결에 실패했습니다. 네트워크 상태를 확인해주세요.', 'error');
      });

      return peer;
    } catch (error) {
      console.error('[WebRTC] Failed to create peer:', error);
      showToast('WebRTC Peer 생성에 실패했습니다.', 'error');
      return null;
    }
  }, [user, roomID, showToast]);

  const addPeer = useCallback((incomingSignal, senderId, stream) => {
    console.log(`[WebRTC] addPeer called for user: ${senderId}`);
    if (iceServersRef.current.length === 0) {
      console.warn('[WebRTC] addPeer aborted: ICE servers not ready.');
      return null;
    }
    console.log('[WebRTC] Adding peer with ICE servers:', iceServersRef.current);

    try {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        config: { iceServers: iceServersRef.current },
      });

      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });

      peer.on('signal', (signal) => {
        console.log(`[WebRTC] 'signal' event (answer) for ${senderId}`);
        const signalRef = push(ref(database, `rooms/${roomID}/signals/${senderId}`));
        set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
      });

      peer.on('connect', () => console.log(`[WebRTC] 'connect' event: Connection established with ${senderId}`));
      peer.on('stream', (remoteStream) => console.log(`[WebRTC] 'stream' event: Received remote stream from ${senderId}`, remoteStream));
      peer.on('close', () => console.log(`[WebRTC] 'close' event: Connection closed with ${senderId}`));
      peer.on('error', (err) => {
        console.error(`[WebRTC] 'error' event with ${senderId}:`, err);
        showToast('연결에 실패했습니다. 네트워크 상태를 확인해주세요.', 'error');
      });

      peer.signal(incomingSignal);
      
      return peer;
    } catch (error) {
        console.error('[WebRTC] Failed to add peer:', error);
        showToast('상대방과의 WebRTC 연결에 실패했습니다.', 'error');
        return null;
    }
  }, [user, roomID, showToast]);
  
  return { createPeer, addPeer, iceServersReady: iceServers.length > 0 };
}