// hooks/useWebRTC.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import useAppStore from '@/store/useAppStore';

export function useWebRTC(localStream) {
  const { user, showToast } = useAppStore();
  const [peer, setPeer] = useState(null);
  const [connections, setConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const peerInstance = useRef(null);

  useEffect(() => {
    if (!user || !localStream) return;

    const initializePeer = async () => {
      try {
        const iceServers = await fetch('/api/turn').then(res => res.json()).then(data => data.iceServers);
        
        const newPeer = new Peer(user.uid, {
          config: { iceServers },
          debug: 2, 
        });

        newPeer.on('open', (id) => {
          console.log('[useWebRTC] Peer connection open. ID:', id);
          setPeer(newPeer);
          peerInstance.current = newPeer;
        });

        newPeer.on('call', (call) => {
          console.log(`[useWebRTC] Incoming call from ${call.peer}`);
          call.answer(localStream);
          setupCallListeners(call);
        });

        newPeer.on('error', (err) => {
          console.error('[useWebRTC] PeerJS error:', err);
          showToast(`WebRTC 오류: ${err.type}`, 'error');
        });

        newPeer.on('disconnected', () => {
            console.log('[useWebRTC] Peer disconnected. Attempting to reconnect...');
            newPeer.reconnect();
        });
        
      } catch (error) {
        console.error("Failed to initialize Peer:", error);
        showToast('WebRTC 초기화에 실패했습니다.', 'error');
      }
    };

    if (!peerInstance.current) {
      initializePeer();
    }
    
    return () => {
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
        setPeer(null);
        console.log('[useWebRTC] Peer instance destroyed.');
      }
    };
  }, [user, localStream, showToast]);
  
  const setupCallListeners = useCallback((call) => {
    call.on('stream', (remoteStream) => {
      console.log(`[useWebRTC] Received remote stream from ${call.peer}`);
      setRemoteStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
    });

    call.on('close', () => {
      console.log(`[useWebRTC] Call with ${call.peer} closed.`);
      setConnections(prev => {
        const newConns = { ...prev };
        delete newConns[call.peer];
        return newConns;
      });
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[call.peer];
        return newStreams;
      });
    });
    
    call.on('error', (err) => {
        console.error(`[useWebRTC] Call error with ${call.peer}:`, err);
    });

    setConnections(prev => ({ ...prev, [call.peer]: call }));
  }, []);

  const callPeer = useCallback((remotePeerId) => {
    if (!peer || !localStream) {
      console.error('[useWebRTC] Cannot call: Peer or local stream not ready.');
      return;
    }
    console.log(`[useWebRTC] Calling ${remotePeerId}`);
    const call = peer.call(remotePeerId, localStream);
    if (call) {
      setupCallListeners(call);
    }
  }, [peer, localStream, setupCallListeners]);
  
  const disconnectAll = useCallback(() => {
    Object.values(connections).forEach(conn => conn.close());
    setConnections({});
    setRemoteStreams({});
  }, [connections]);

  return { peer, connections, remoteStreams, callPeer, disconnectAll };
}