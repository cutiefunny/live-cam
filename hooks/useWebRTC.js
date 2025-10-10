// hooks/useWebRTC.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import useAppStore from '@/store/useAppStore';

// ✨ [수정] Peer 인스턴스를 저장하고 관리할 전역 변수 (싱글톤)
let peerInstance = null;

// ✨ [추가] Peer 인스턴스를 생성하거나 가져오는 싱글톤 함수
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

// ✨ [추가] Peer 인스턴스를 안전하게 파괴하는 함수
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

  const setMyStream = useCallback((stream) => {
    myStreamRef.current = stream;
    _setMyStream(stream);
  }, []);

  useEffect(() => {
    // ✨ [수정] 이 훅은 더 이상 Peer 객체를 직접 관리하지 않고, 이벤트 리스너만 담당합니다.
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
      if (peerInstance && !peerInstance.destroyed) {
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