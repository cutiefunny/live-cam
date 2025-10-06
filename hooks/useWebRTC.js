// hooks/useWebRTC.js
import { useCallback, useState, useEffect } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useWebRTC(user, roomID) {
  // 기본 STUN 서버 목록으로 iceServers 상태를 초기화합니다.
  // 이렇게 하면 TURN 서버를 가져오기 전이나 실패했을 때도 항상 기본 설정이 유지됩니다.
  const [iceServers, setIceServers] = useState([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]);

  // 컴포넌트가 마운트될 때 API로부터 TURN 서버 정보를 비동기적으로 가져옵니다.
  useEffect(() => {
    const fetchTurnServers = async () => {
      try {
        const response = await fetch('/api/turn');
        if (!response.ok) {
          throw new Error('Failed to fetch TURN servers');
        }
        const data = await response.json();
        console.log("Successfully fetched TURN servers from Twilio.");
        // 기존 STUN 서버 목록에 가져온 TURN 서버 정보를 추가합니다.
        setIceServers(prevServers => [...prevServers, ...data.iceServers]);
      } catch (error) {
        // TURN 서버 가져오기에 실패해도 기본 STUN 서버로 연결을 시도할 수 있습니다.
        console.warn("Could not fetch TURN servers. Proceeding with STUN only.", error);
      }
    };

    fetchTurnServers();
  }, []); // 이 useEffect는 컴포넌트 마운트 시 한 번만 실행됩니다.

  const createPeer = useCallback((otherUserID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: { iceServers }, // 항상 STUN 서버가 포함된 설정 사용
    });

    peer.on('signal', (signal) => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${otherUserID}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });
    
    peer.on('connect', () => console.log(`[${user.displayName}] Connection established with ${otherUserID}`));
    peer.on('error', (err) => console.error(`[${user.displayName}] Connection error with ${otherUserID}:`, err));

    return peer;
  }, [user, roomID, iceServers]);

  const addPeer = useCallback((incomingSignal, senderId, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: { iceServers }, // 항상 STUN 서버가 포함된 설정 사용
    });

    peer.on('signal', (signal) => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${senderId}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });

    peer.on('connect', () => console.log(`[${user.displayName}] Connection established with ${senderId}`));
    peer.on('error', (err) => console.error(`[${user.displayName}] Connection error with ${senderId}:`, err));

    peer.signal(incomingSignal);
    return peer;
  }, [user, roomID, iceServers]);
  
  // iceServers가 항상 기본값을 가지므로, iceServersReady는 항상 true입니다.
  return { createPeer, addPeer, iceServersReady: true };
}