// hooks/useWebRTC.js
'use client';
import Peer from 'peerjs';

// ✨ WebRTC 연결을 전담 관리하는 싱글톤 객체
const WebRTCManager = {
  peer: null,
  localStream: null,
  setPeers: null,
  showToast: null,

  // 1. Peer 객체 초기화
  initialize(user, iceServers, setPeersCallback, showToastCallback) {
    // 이미 연결되어 있다면 아무것도 하지 않음
    if (this.peer && !this.peer.destroyed) {
      console.log('[WebRTCManager] Peer already initialized.');
      return;
    }

    if (!user || !iceServers || iceServers.length === 0) {
      console.error('[WebRTCManager] Cannot initialize: user or ICE servers missing.');
      return;
    }
    
    console.log('[WebRTCManager] Initializing Peer instance...');
    this.peer = new Peer(user.uid, {
      config: { iceServers },
    });

    // React 상태 업데이트 함수와 토스트 함수를 저장
    this.setPeers = setPeersCallback;
    this.showToast = showToastCallback;

    // 모든 이벤트 리스너를 한 번만 등록
    this.peer.on('open', this.handleOpen);
    this.peer.on('call', this.handleCall);
    this.peer.on('error', this.handleError);
    this.peer.on('disconnected', this.handleDisconnected);
  },

  // 2. 로컬 미디어 스트림 설정
  setLocalStream(stream) {
    this.localStream = stream;
  },

  // 3. 전화 걸기
  callPeer(remotePeerId) {
    if (!this.peer || !this.localStream) {
      console.error('[WebRTCManager] Cannot call: Peer or local stream not ready.');
      return;
    }
    console.log(`[WebRTCManager] Calling ${remotePeerId}`);
    const call = this.peer.call(remotePeerId, this.localStream);
    this.attachCallListeners(call);
  },
  
  // 4. 연결 종료 및 모든 자원 해제
  destroy() {
    console.log('[WebRTCManager] Destroying Peer instance and cleaning up.');
    if (this.peer) {
      // 모든 이벤트 리스너 제거
      this.peer.off('open', this.handleOpen);
      this.peer.off('call', this.handleCall);
      this.peer.off('error', this.handleError);
      this.peer.off('disconnected', this.handleDisconnected);
      
      if (!this.peer.destroyed) {
        this.peer.destroy();
      }
    }
    this.peer = null;
    this.localStream = null;
    this.setPeers = null;
    this.showToast = null;
  },

  // --- 이벤트 핸들러 ---
  handleOpen(id) {
    console.log('[WebRTCManager] Peer connection open. ID:', id);
  },

  handleCall(call) {
    console.log(`[WebRTCManager] Incoming call from ${call.peer}`);
    if (WebRTCManager.localStream) {
      call.answer(WebRTCManager.localStream);
      WebRTCManager.attachCallListeners(call);
    } else {
      console.warn('[WebRTCManager] No local stream to answer call.');
    }
  },

  handleError(err) {
    console.error('[WebRTCManager] PeerJS error:', err);
    if (WebRTCManager.showToast && err.type !== 'peer-unavailable' && err.type !== 'unavailable-id') {
      WebRTCManager.showToast(`WebRTC 연결 오류: ${err.type}`, 'error');
    }
  },
  
  handleDisconnected() {
     console.log('[WebRTCManager] Peer disconnected from server.');
  },

  attachCallListeners(call) {
    call.on('stream', (remoteStream) => {
      console.log(`[WebRTCManager] Received remote stream from ${call.peer}`);
      if (WebRTCManager.setPeers) {
        WebRTCManager.setPeers(prev => ({ ...prev, [call.peer]: { call, remoteStream } }));
      }
    });

    call.on('close', () => {
      console.log(`[WebRTCManager] Call with ${call.peer} closed.`);
      if (WebRTCManager.setPeers) {
        WebRTCManager.setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[call.peer];
          return newPeers;
        });
      }
    });
  }
};

export default WebRTCManager;