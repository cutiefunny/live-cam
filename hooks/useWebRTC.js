// hooks/useWebRTC.js
'use client';
// ✨ [수정] useCallback을 import 합니다.
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import useAppStore from '@/store/useAppStore';

let peerInstance = null;

export const initializePeer = (user, iceServers) => {
  if (peerInstance && !peerInstance.destroyed) {
    console.log('[WebRTC] Returning existing global Peer instance.');
    return peerInstance;
  }
  if (!user || !iceServers || iceServers.length === 0) {
    console.error('[Peer] Cannot create Peer instance: user or ICE servers missing.');
    return null;
  }
  console.log('[WebRTC] Creating new global Peer instance...');
  peerInstance = new Peer(user.uid, {
    config: { iceServers },
  });
  return peerInstance;
};

export const destroyPeer = () => {
  if (peerInstance && !peerInstance.destroyed) {
    console.log('[WebRTC] Destroying global Peer instance.');
    peerInstance.destroy();
  }
  peerInstance = null;
};

export function useWebRTC() {
  const [myStream, _setMyStream] = useState(null);
  const myStreamRef = useRef(null);
  const [peers, setPeers] = useState({});
  const { showToast } = useAppStore();

  // ✨ [수정] setMyStream 함수를 useCallback으로 감싸서 안정적인 함수로 만듭니다.
  const setMyStream = useCallback((stream) => {
    myStreamRef.current = stream;
    _setMyStream(stream);
  }, []); // 의존성 배열이 비어있으므로 이 함수는 절대로 재생성되지 않습니다.

  useEffect(() => {
    if (!peerInstance) {
      console.warn('[useWebRTC] Peer instance is not initialized yet.');
      return;
    }

    const handleCall = (call) => {
      console.log(`[WebRTC] Incoming call from ${call.peer}`);
      if (myStreamRef.current) {
        call.answer(myStreamRef.current);
        
        call.on('stream', (remoteStream) => {
          setPeers(prev => ({ ...prev, [call.peer]: { call, remoteStream } }));
        });

        call.on('close', () => {
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[call.peer];
            return newPeers;
          });
        });
      } else {
        console.warn('[WebRTC] Incoming call but no local stream. Ignoring call.');
      }
    };
    
    const handleError = (err) => {
      console.error('[WebRTC] PeerJS error:', err);
      if (err.type !== 'peer-unavailable' && err.type !== 'unavailable-id') {
        showToast(`WebRTC 연결 오류: ${err.type}`, 'error');
      }
    };

    peerInstance.on('call', handleCall);
    peerInstance.on('error', handleError);

    return () => {
      console.log('[useWebRTC] Cleaning up event listeners.');
      if (peerInstance) {
        peerInstance.off('call', handleCall);
        peerInstance.off('error', handleError);
      }
    };
  }, [showToast]);

  const callPeer = (remotePeerId) => {
    if (!peerInstance || !myStreamRef.current) {
      console.error('[WebRTC] Cannot call: Peer or local stream not ready.');
      return;
    }

    const call = peerInstance.call(remotePeerId, myStreamRef.current);

    if (call) {
      call.on('stream', (remoteStream) => {
        setPeers(prev => ({ ...prev, [remotePeerId]: { call, remoteStream } }));
      });
      call.on('close', () => {
         setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[remotePeerId];
            return newPeers;
          });
      });
  
      call.on('error', (err) => {
        console.error(`[WebRTC] Call with ${remotePeerId} failed:`, err);
      });
    }
  };
  
  return { peer: peerInstance, myStream, peers, callPeer, setMyStream };
}