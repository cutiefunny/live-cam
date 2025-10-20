// hooks/useWebRTC.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import useAppStore from '@/store/useAppStore';
import { nanoid } from 'nanoid';

// 개발 환경 ID 접미사 생성 관련 로직은 유지
const getDevelopmentPeerIdSuffix = () => nanoid(4);

export function useWebRTC(localStream) {
  const user = useAppStore((state) => state.user);
  const showToast = useAppStore((state) => state.showToast);
  const [connections, setConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const peerInstance = useRef(null);
  const isInitializing = useRef(false);
  const retryTimeoutRef = useRef(null);
  const isDestroyedRef = useRef(false);

  // ✨ setupCallListeners 정의를 useEffect보다 위로 이동
  const setupCallListeners = useCallback((call, actualPeerUserId) => {
    const peerId = call.peer;
    // 실제 사용자 ID 결정 로직 (개발 환경 접미사 제거)
    const userId = actualPeerUserId || (process.env.NODE_ENV === 'development' && peerId.includes('-') ? peerId.substring(0, peerId.lastIndexOf('-')) : peerId);

    console.log(`[useWebRTC] Setting up listeners for call with ${peerId} (User: ${userId})`); // 로그 추가

    call.on('stream', (remoteStream) => {
      console.log(`[useWebRTC] Received remote stream from ${peerId} (User: ${userId})`);
      if (!isDestroyedRef.current) {
          setRemoteStreams(prev => {
            if (prev[userId] && prev[userId].id === remoteStream.id) {
              return prev;
            }
            // 수신 시 스트림 객체와 함께 peerId(연결 ID)도 저장하면 디버깅에 유용할 수 있음
            return { ...prev, [userId]: remoteStream };
          });
      }
    });

    call.on('close', () => {
      console.log(`[useWebRTC] Call with ${peerId} (User: ${userId}) closed.`);
      if (!isDestroyedRef.current) {
          setConnections(prev => {
            const newConns = { ...prev };
            delete newConns[userId];
            return newConns;
          });
          setRemoteStreams(prev => {
            const newStreams = { ...prev };
            delete newStreams[userId];
            return newStreams;
          });
      }
    });

    call.on('error', (err) => {
        console.error(`[useWebRTC] Call error with ${peerId} (User: ${userId}):`, err);
    });

    if (!isDestroyedRef.current) {
        setConnections(prev => ({ ...prev, [userId]: call }));
    }
  }, []); // 의존성 없음

  // ✨ getPeerId 정의 이동
  const getPeerId = useCallback(() => {
    if (!user) return null;
    if (process.env.NODE_ENV === 'development') {
      const suffix = getDevelopmentPeerIdSuffix(); // 매번 새 접미사 생성
      const devPeerId = `${user.uid}-${suffix}`;
      console.log(`[useWebRTC] Development mode: Generated peer ID: ${devPeerId}`);
      return devPeerId;
    } else {
      return user.uid;
    }
  }, [user]);

  // ✨ initializePeer 정의 이동 (setupCallListeners 사용하므로 그 뒤에 위치)
  const initializePeer = useCallback(async () => {
    const peerId = getPeerId();
    // 초기화 조건 확인 강화
    if (!user || !localStream || peerInstance.current || isInitializing.current || isDestroyedRef.current || !peerId) {
      console.log('[useWebRTC] InitializePeer skipped. Conditions:', { hasUser: !!user, hasLocalStream: !!localStream, peerExists: !!peerInstance.current, isInitializing: isInitializing.current, isDestroyed: isDestroyedRef.current, hasPeerId: !!peerId });
      isInitializing.current = false;
      // 예약된 재시도 취소
      if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
      }
      return;
    }

    console.log(`[useWebRTC] Initializing Peer with ID: ${peerId}...`);
    isInitializing.current = true;
    let peer = null;

    try {
      const iceServers = await fetch('/api/turn').then(res => res.json()).then(data => data.iceServers);

      peer = new Peer(peerId, {
        config: { iceServers },
        debug: 2,
      });

      peerInstance.current = peer; // 새 인스턴스를 즉시 ref에 할당
      console.log('[useWebRTC] Peer instance created:', peer.id);

      peer.on('open', (id) => {
        // isDestroyedRef 사용 및 현재 인스턴스 확인
        if (!isDestroyedRef.current && peer === peerInstance.current) {
          console.log('[useWebRTC] Peer connection open. ID:', id);
          isInitializing.current = false; // 초기화 완료
        } else {
          console.log('[useWebRTC] Peer opened but component unmounted or instance changed. Destroying this instance.');
          peer?.destroy(); // 현재 로컬 peer 변수만 파괴
           if (peerInstance.current === peer) peerInstance.current = null; // ref도 정리
          isInitializing.current = false;
        }
      });

      peer.on('call', (call) => {
         // isDestroyedRef 사용 및 현재 인스턴스 확인
        if (!isDestroyedRef.current && peer === peerInstance.current) {
          console.log(`[useWebRTC] Incoming call from ${call.peer}`);
          const actualPeerUserId = process.env.NODE_ENV === 'development' && call.peer.includes('-') ? call.peer.substring(0, call.peer.lastIndexOf('-')) : call.peer;
          console.log(`[useWebRTC] Actual caller User ID: ${actualPeerUserId}`);

          if (localStream) {
            call.answer(localStream);
            setupCallListeners(call, actualPeerUserId); // ✨ setupCallListeners 호출
          } else {
            console.error('[useWebRTC] Incoming call but localStream is missing!');
            call.close();
          }
        } else {
          console.log(`[useWebRTC] Incoming call from ${call.peer} received after cleanup or instance change. Closing call.`);
          call.close();
        }
      });

      peer.on('error', (err) => {
        console.error('[useWebRTC] PeerJS error:', err);
        isInitializing.current = false;

        const currentPeerOnError = peerInstance.current;
        // 현재 이벤트 핸들러가 속한 인스턴스에서 발생한 오류인지 확인 후 처리
        if (currentPeerOnError === peer) {
            if (!currentPeerOnError.destroyed) {
                console.log(`[useWebRTC] Destroying peer instance ${peer.id} due to error: ${err.type}`);
                currentPeerOnError.destroy();
            }
            peerInstance.current = null; // ref 초기화
        } else {
             console.warn(`[useWebRTC] Error received for an outdated or different peer instance (${peer?.id}). Current ref: ${currentPeerOnError?.id}`);
             // 오래된 인스턴스에서 에러가 났다면 해당 인스턴스도 파괴 시도 (방어 코드)
             if (peer && !peer.destroyed) {
                 peer.destroy();
             }
        }


        // 'unavailable-id' 오류 시 재시도 (동적 ID 사용 시 발생 확률 낮음)
        if (err.type === 'unavailable-id') {
          if (!isDestroyedRef.current) {
            showToast(`연결 ID(${peerId}) 사용 중. 잠시 후 재시도합니다...`, 'error');
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            // ✨ initializePeer 재호출 예약
            retryTimeoutRef.current = setTimeout(initializePeer, process.env.NODE_ENV === 'development' ? 250 : 50);
          }
        }
        // ... (다른 오류 처리)
        else if (err.type === 'peer-unavailable') {
          console.warn(`[useWebRTC] Peer ${err.message?.match(/peer\s(.*?)\s/)?.[1] || ''} is unavailable.`);
        }
        else if (!isDestroyedRef.current) {
          showToast(`WebRTC 오류: ${err.type || '연결 실패'}`, 'error');
        }
      });

      peer.on('disconnected', () => {
        if (!isDestroyedRef.current && peerInstance.current === peer && !peerInstance.current.destroyed) {
          console.warn('[useWebRTC] Peer disconnected.');
          // ✨ 연결 끊김 시 인스턴스 파괴 및 ref 초기화
          console.log(`[useWebRTC] Destroying peer instance ${peer.id} due to disconnection.`);
          peerInstance.current.destroy();
          peerInstance.current = null;
          if (!isDestroyedRef.current) showToast('WebRTC 연결이 끊어졌습니다.', 'error');
        }
      });

      peer.on('close', () => {
        console.log(`[useWebRTC] Peer connection closed for ${peer?.id}.`);
        if (peerInstance.current === peer) {
          peerInstance.current = null;
        }
        isInitializing.current = false;
      });

    } catch (error) {
      console.error("[useWebRTC] Failed to initialize Peer:", error);
      isInitializing.current = false;
      if (!isDestroyedRef.current) {
        showToast('WebRTC 초기화 중 오류 발생.', 'error');
      }
      // ✨ 초기화 실패 시 ref 정리
      if (peerInstance.current === peer) {
          peerInstance.current = null;
      }
    }
  }, [user, localStream, showToast, setupCallListeners, getPeerId]); // ✨ getPeerId 추가

  // ✨ Main useEffect: 초기화 트리거 및 Cleanup 담당
  useEffect(() => {
    isDestroyedRef.current = false; // 컴포넌트 마운트 시 초기화

    // localStream 준비 시 초기화 시도
    if (user && localStream && !peerInstance.current && !isInitializing.current) {
        console.log('[useWebRTC] Conditions met, calling initializePeer.');
        // ✨ 지연 없이 바로 호출
        initializePeer();
    } else {
        console.log('[useWebRTC] useEffect: Skipping initial call to initializePeer.', { hasUser:!!user, hasLocalStream:!!localStream, peerExists:!!peerInstance.current, isInitializing:isInitializing.current });
    }

    // Cleanup 함수
    return () => {
      isDestroyedRef.current = true;
      isInitializing.current = false;
      // 예약된 재시도 타임아웃 클리어
      if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
          console.log('[useWebRTC] Cleanup: Cleared pending retry timeout.');
      }

      console.log('[useWebRTC] Cleanup: Attempting to destroy Peer instance...');
      // ✨ 안전하게 destroy 호출
      const peerToDestroy = peerInstance.current;
      peerInstance.current = null; // ref 즉시 초기화
      if (peerToDestroy && !peerToDestroy.destroyed) {
        peerToDestroy.destroy();
        console.log('[useWebRTC] Cleanup: Peer instance destroyed.');
      } else {
        console.log('[useWebRTC] Cleanup: Peer instance already destroyed or not initialized.');
      }
      // 상태 초기화
      setConnections({});
      setRemoteStreams({});
    };
  }, [user, localStream, initializePeer]); // ✨ initializePeer 의존성 추가

  // ✨ callPeer 정의 이동
  const callPeer = useCallback((remoteUserId) => {
    if (isDestroyedRef.current) {
        console.warn('[useWebRTC] Attempted to callPeer after component unmounted.');
        return;
    }

    if (!peerInstance.current || peerInstance.current.destroyed || !localStream) {
      console.error('[useWebRTC] Cannot call: Peer not ready or destroyed, or local stream unavailable.', { peerReady: !!peerInstance.current, peerDestroyed: peerInstance.current?.destroyed, hasLocalStream: !!localStream });
      showToast('통화를 걸 수 있는 상태가 아닙니다.', 'error');
      return;
    }

    // 상대방 Peer ID 결정 (시그널링 필요 - 임시 로직 유지)
    let remotePeerIdToCall = remoteUserId;
    if (process.env.NODE_ENV === 'development') {
        const currentIdParts = peerInstance.current.id.split('-');
        const currentSuffix = currentIdParts.length > 1 ? currentIdParts.pop() : null; // 현재 접미사
        if (currentSuffix) {
             remotePeerIdToCall = `${remoteUserId}-${currentSuffix}`;
             console.warn(`[useWebRTC] Development mode: Calling dynamic ID ${remotePeerIdToCall}. Ensure suffixes match via signaling.`);
        } else {
             console.warn(`[useWebRTC] Development mode: Current Peer ID has no suffix? Calling with original ID: ${remoteUserId}`);
             remotePeerIdToCall = remoteUserId; // 접미사 없으면 원래 ID로 호출
        }
        // ***** 실제 구현에서는 시그널링 서버를 통해 상대방의 정확한 PeerJS ID 조회 *****
    }

    console.log(`[useWebRTC] Calling Peer ID: ${remotePeerIdToCall} (User: ${remoteUserId})`);

    try {
        if (!localStream) {
            console.error('[useWebRTC] Cannot call: localStream is missing.');
            showToast('카메라/마이크 스트림이 준비되지 않았습니다.', 'error');
            return;
        }
        const call = peerInstance.current.call(remotePeerIdToCall, localStream);
        if (call) {
          setupCallListeners(call, remoteUserId); // 실제 userId 전달
        } else {
          console.error('[useWebRTC] Failed to create call object.');
          showToast('통화 시작에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('[useWebRTC] Error during call initiation:', error);
        showToast('통화 시작 중 오류가 발생했습니다.', 'error');
    }
  }, [localStream, setupCallListeners, showToast]); // ✨ peerInstance 제거 (ref이므로 의존성 불필요)

  // ✨ disconnectAll 정의 이동
  const disconnectAll = useCallback(() => {
    console.log('[useWebRTC] Disconnecting all calls.');
    Object.keys(connections).forEach(userId => {
        const conn = connections[userId];
        if (conn && typeof conn.close === 'function') { // ✨ close 함수 존재 여부 확인
             try {
                conn.close();
             } catch (closeErr) {
                 console.error(`[useWebRTC] Error closing connection with Peer ${conn.peer} (User: ${userId}):`, closeErr);
             }
        }
    });
    if (!isDestroyedRef.current) {
        setConnections({});
        setRemoteStreams({});
    }
  }, [connections]); // ✨ connections 의존성 유지


  return { connections, remoteStreams, callPeer, disconnectAll, peerInstance };
}