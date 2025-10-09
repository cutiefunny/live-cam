// hooks/useWebRTC.js
'use client';
import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import useAppStore from '@/store/useAppStore';

export function useWebRTC(user, roomID) {
  const [peer, setPeer] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [peers, setPeers] = useState({});
  const showToast = useAppStore((state) => state.showToast);
  const [iceServers, setIceServers] = useState([]);

  useEffect(() => {
    console.log('[WebRTC] Hook mounted. Fetching ICE servers...');
    const fetchIceServers = async () => {
      try {
        const response = await fetch('/api/turn');
        if (!response.ok) throw new Error('Failed to fetch ICE servers');
        const data = await response.json();
        console.log('[WebRTC] Successfully fetched ICE servers from Twilio.');
        setIceServers(data.iceServers);
      } catch (error) {
        console.error("[WebRTC] Could not fetch ICE servers. Using STUN only.", error);
        showToast('TURN 서버 연결에 실패했습니다. P2P 연결 품질이 저하될 수 있습니다.', 'warn');
        setIceServers([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]);
      }
    };
    fetchIceServers();
  }, [showToast]);

  // ✨ [수정] useEffect 의존성 배열에서 myStream 제거
  useEffect(() => {
    if (!user || !roomID || iceServers.length === 0) return;

    const peerInstance = new Peer(user.uid, {
      config: {
        iceServers: iceServers,
      },
    });

    peerInstance.on('open', (id) => {
      console.log('[WebRTC] My peer ID is: ' + id);
      setPeer(peerInstance);
    });

    peerInstance.on('call', (call) => {
      console.log(`[WebRTC] Incoming call from ${call.peer}`);
      // 'myStream' 상태가 업데이트 되기를 기다리지 않고,
      // navigator.mediaDevices.getUserMedia를 직접 호출하여 스트림으로 응답합니다.
      // 이렇게 하면 myStream 상태에 대한 의존성을 제거할 수 있습니다.
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setMyStream(stream); // UI 업데이트를 위해 상태는 여전히 설정
          call.answer(stream);
          
          call.on('stream', (remoteStream) => {
            console.log(`[WebRTC] Received remote stream from ${call.peer}`);
            setPeers(prev => ({ ...prev, [call.peer]: { call, remoteStream } }));
          });

          call.on('close', () => {
            console.log(`[WebRTC] Call with ${call.peer} closed.`);
            setPeers(prev => {
              const newPeers = { ...prev };
              delete newPeers[call.peer];
              return newPeers;
            });
          });
        }).catch(err => {
            console.error('[WebRTC] Failed to get local stream for incoming call', err);
        });
    });

    peerInstance.on('error', (err) => {
      console.error('[WebRTC] PeerJS error:', err);
      showToast(`WebRTC 연결 오류: ${err.type}`, 'error');
    });

    peerInstance.on('disconnected', () => {
      console.log('[WebRTC] Disconnected from PeerJS server. Attempting to reconnect...');
      peerInstance.reconnect();
    });

    return () => {
      console.log('[WebRTC] Cleaning up PeerJS instance.');
      peerInstance.destroy();
    };
  }, [user, roomID, iceServers, showToast]); // ✨ myStream 의존성 제거

  const callPeer = (remotePeerId) => {
    if (!peer || !myStream) {
      console.error('[WebRTC] Cannot call: Peer or local stream not ready.');
      showToast('WebRTC 연결이 준비되지 않았습니다.', 'error');
      return;
    }

    console.log(`[WebRTC] Calling ${remotePeerId}`);
    const call = peer.call(remotePeerId, myStream);

    call.on('stream', (remoteStream) => {
      console.log(`[WebRTC] Received remote stream from ${remotePeerId}`);
      setPeers(prev => ({ ...prev, [remotePeerId]: { call, remoteStream } }));
    });
    
    call.on('close', () => {
      console.log(`[WebRTC] Call with ${remotePeerId} closed.`);
       setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[remotePeerId];
          return newPeers;
        });
    });

    call.on('error', (err) => {
      console.error(`[WebRTC] Call with ${remotePeerId} failed:`, err);
    });
  };

  return { peer, myStream, peers, callPeer, setMyStream };
}