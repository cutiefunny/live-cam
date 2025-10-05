// hooks/useWebRTC.js
import { useCallback, useState, useEffect } from 'react';
import Peer from 'simple-peer';
import { push, set, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useWebRTC(user, roomID) {
  // iceServers 상태를 관리합니다. 초기값은 빈 배열입니다.
  const [iceServers, setIceServers] = useState([]);

  // 컴포넌트가 마운트될 때 API로부터 TURN 서버 정보를 가져옵니다.
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const response = await fetch('/api/turn');
        if (!response.ok) {
          throw new Error('Failed to fetch ICE servers');
        }
        const data = await response.json();
        console.log("Successfully fetched ICE servers from Twilio.");
        setIceServers(data.iceServers);
      } catch (error) {
        console.error("Could not fetch ICE servers. Using STUN only.", error);
        // 실패 시 기본 STUN 서버만 사용합니다.
        setIceServers([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]);
      }
    };

    fetchIceServers();
  }, []); // 이 useEffect는 한 번만 실행됩니다.

  const createPeer = useCallback((otherUserID, stream) => {
    // iceServers가 아직 준비되지 않았다면 Peer를 생성하지 않습니다.
    if (iceServers.length === 0) return null;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: { iceServers }, // 상태에 저장된 서버 정보 사용
    });

    peer.on('signal', (signal) => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${otherUserID}`));
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL, senderDisplayName: user.displayName });
    });
    
    peer.on('connect', () => console.log(`[${user.displayName}] Connection established with ${otherUserID}`));
    peer.on('error', (err) => console.error(`[${user.displayName}] Connection error with ${otherUserID}:`, err));

    return peer;
  }, [user, roomID, iceServers]); // iceServers가 변경되면 함수를 재생성합니다.

  const addPeer = useCallback((incomingSignal, senderId, stream) => {
    if (iceServers.length === 0) return null;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: { iceServers }, // 상태에 저장된 서버 정보 사용
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
  
  return { createPeer, addPeer, iceServersReady: iceServers.length > 0 };
}