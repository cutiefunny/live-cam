// app/room/[roomId]/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Video from '@/components/Video';
import Controls from '@/components/Controls';
import CallQualityIndicator from '@/components/CallQualityIndicator';
import GiftModal from '@/components/GiftModal';
import LeaveConfirmModal from '@/components/LeaveConfirmModal';
import { useCoin } from '@/hooks/useCoin';
import { useWebRTC, initializePeer, destroyPeer } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';
import { useCallQuality } from '@/hooks/useCallQuality';
import useAppStore from '@/store/useAppStore';
import styles from './Room.module.css';
import { ref, onValue, off, remove, set, get, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';

const createDummyStream = () => {
  console.log('[DummyStream] Creating dummy stream for spectator mode.');
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const dst = oscillator.connect(audioContext.createMediaStreamDestination());
  oscillator.start();
  const audioTrack = dst.stream.getAudioTracks()[0];

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1, 1);
  }
  const videoStream = canvas.captureStream();
  const videoTrack = videoStream.getVideoTracks()[0];

  const dummyStream = new MediaStream([audioTrack, videoTrack]);
  dummyStream.getAudioTracks().forEach(track => track.enabled = false);
  return dummyStream;
};


export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();
  const { sendGift } = useCoin();
  
  const { 
    user, isAuthLoading, isCreator, giftAnimation, setGiftAnimation, 
    showToast, openRatingModal 
  } = useAppStore();

  const { settings, isLoading: isSettingsLoading } = useSettings();
  const userVideo = useRef();
  
  const { peer, myStream, peers, callPeer, setMyStream } = useWebRTC();
  const [iceServers, setIceServers] = useState([]);
  const peerRef = useRef(null);
  
  const [otherUser, setOtherUser] = useState(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  
  const callEndedRef = useRef(false);
  const backPressState = useRef({ pressedOnce: false, timeoutId: null });
  const callPartnerRef = useRef(null); 

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState(null);
  const callStartTimeRef = useRef(null);

  const remotePeerEntry = otherUser ? peers[otherUser.uid] : null;
  const callQuality = useCallQuality(remotePeerEntry?.call);
  const [callStarted, setCallStarted] = useState(false);
  
  useEffect(() => {
    fetch('/api/turn')
      .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch'))
      .then(data => setIceServers(data.iceServers))
      .catch(err => {
        console.error("[WebRTC] Could not fetch ICE servers.", err);
        showToast('TURN 서버 연결에 실패했습니다.', 'warn');
        setIceServers([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]);
      });
  }, [showToast]);

  useEffect(() => {
    if (isAuthLoading || !user) {
      if (!isAuthLoading) router.push('/');
      return;
    }

    let streamRef = null;

    const setup = async () => {
      // 1. Peer 객체 초기화 (ICE 서버 정보가 준비된 후에)
      if (iceServers.length > 0) {
        peerRef.current = initializePeer(user, iceServers);
      }

      // 2. 미디어 스트림 가져오기 또는 더미 스트림 생성
      try {
        streamRef = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('[RoomPage] Media stream acquired.');
      } catch (err) {
        // ✨ [수정 시작] NotFoundError일 경우, error가 아닌 info log로 처리합니다.
        if (err.name === 'NotFoundError') {
          console.log('[RoomPage] Media device not found. Creating dummy stream for spectator mode.');
          showToast('카메라/마이크를 찾을 수 없습니다. 관전자 모드로 참여합니다.', 'info');
        } else {
          console.error("[RoomPage] getUserMedia error:", err);
          showToast('카메라/마이크 접근에 실패했습니다.', 'error');
        }
        streamRef = createDummyStream();
        // ✨ [수정 끝]
      }
      setMyStream(streamRef);

      // 3. Realtime Database에 사용자 정보 등록
      const currentUserRef = ref(database, `rooms/${roomId}/users/${user.uid}`);
      set(currentUserRef, {
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
        joinTime: rtdbServerTimestamp()
      });
      onDisconnect(currentUserRef).remove();
    };

    if(iceServers.length > 0) {
      setup();
    }

    return () => {
      if (streamRef) {
        console.log('[Cleanup] Stopping media tracks.');
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user, roomId, iceServers]);

  useEffect(() => {
    const handleBeforeUnload = () => destroyPeer();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      destroyPeer();
    };
  }, []);
  
  useEffect(() => {
    const roomUsersRef = ref(database, `rooms/${roomId}/users`);
    const listener = onValue(roomUsersRef, (snapshot) => {
        const usersInRoom = snapshot.val();
        if (usersInRoom && !callStartTimeRef.current) callStartTimeRef.current = Date.now();
        if (!usersInRoom && callStarted) { executeLeaveRoom(); return; }

        if (usersInRoom) {
            const otherUserId = Object.keys(usersInRoom).find(uid => uid !== user?.uid);
            if (otherUserId) {
                const partnerInfo = { uid: otherUserId, ...usersInRoom[otherUserId] };
                setOtherUser(partnerInfo);
                callPartnerRef.current = partnerInfo;
                if (!callStarted) setCallStarted(true);
            } else {
                setOtherUser(null);
                callPartnerRef.current = null;
                if (callStarted) executeLeaveRoom();
            }
        }
    });

    return () => off(roomUsersRef, 'value', listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId, callStarted]);

  useEffect(() => {
    if (myStream && userVideo.current) {
      userVideo.current.srcObject = myStream;
    }
  }, [myStream]);
  
  useEffect(() => {
    if (peerRef.current && myStream && otherUser && !peers[otherUser.uid] && !isCreator && user.uid > otherUser.uid) {
        console.log(`[RoomPage] My UID is greater. Attempting to call ${otherUser.uid}`);
        callPeer(otherUser.uid);
    }
  }, [myStream, otherUser, peers, callPeer, isCreator, user]);
  
  const executeLeaveRoom = () => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    if (backPressState.current.timeoutId) clearTimeout(backPressState.current.timeoutId);
    window.onpopstate = null; 
    const partnerInfo = callPartnerRef.current;

    if (!isCreator && partnerInfo) {
      openRatingModal({ 
        creatorId: partnerInfo.uid, 
        creatorName: partnerInfo.displayName 
      });
    }
    
    router.replace('/');
  };
  
  const handleLeaveRoom = () => {
    if (!callStartTimeRef.current) {
        executeLeaveRoom();
        return;
    }
    const duration = Date.now() - callStartTimeRef.current;
    setLeaveDetails({ duration });
    setIsLeaveModalOpen(true);
  };
  
  useEffect(() => {
    history.pushState(null, '', location.href);
    const handlePopState = () => {
      history.pushState(null, '', location.href);
      if (backPressState.current.pressedOnce) {
        if (backPressState.current.timeoutId) clearTimeout(backPressState.current.timeoutId);
        handleLeaveRoom();
      } else {
        backPressState.current.pressedOnce = true;
        showToast('한 번 더 누르면 통화가 종료됩니다.', 'info');
        backPressState.current.timeoutId = setTimeout(() => {
          backPressState.current.pressedOnce = false;
        }, 2000);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const handleSendGift = async (gift) => {
    if (!user || !otherUser) return;
    try {
      await sendGift(user.uid, otherUser.uid, gift, roomId);
    } catch(error) {
      showToast(error.message, 'error');
    }
  };
  
  if (isAuthLoading || isSettingsLoading || !user) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
          <div style={{fontSize: '1.25rem'}}>Connecting...</div>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      {giftAnimation && (
        <div className={styles.giftAnimationOverlay}>
          <div className={styles.giftAnimationContent}>
            <span className={styles.giftIcon}>{giftAnimation.icon}</span>
            <p>{giftAnimation.senderName}님이 {giftAnimation.name} 선물을 보냈습니다!</p>
          </div>
        </div>
      )}
      <header className={styles.header}>
        <h1 className={styles.roomInfo}>Room: <span className={styles.roomId}>{roomId}</span></h1>
        {remotePeerEntry && <CallQualityIndicator quality={callQuality} />}
        <button onClick={handleLeaveRoom} className={styles.exitButton}>
          Leave Room
        </button>
      </header>
      <main className={styles.main}>
        {myStream ? (
            <div className={styles.myVideoContainer}>
                <video muted ref={userVideo} autoPlay playsInline className={styles.video} />
                <div className={styles.displayName}>
                  {user.displayName} (You)
                </div>
            </div>
        ) : (
          <div className={styles.spectatorPip}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spectatorIcon}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <p>Spectator Mode</p>
          </div>
        )}
        {remotePeerEntry && otherUser ? (
          <div className={styles.remoteVideoContainer}>
            <Video 
              key={remotePeerEntry.call.peer}
              stream={remotePeerEntry.remoteStream} 
              photoURL={otherUser.photoURL} 
              displayName={otherUser.displayName} 
            />
          </div>
        ) : (
          <div className={styles.waitingMessage}>
            <h2>Waiting for other participant...</h2>
          </div>
        )}
      </main>
      {myStream && (
        <footer className={styles.footer}>
          <Controls stream={myStream} />
          {!isCreator && otherUser && (
            <button onClick={() => setIsGiftModalOpen(true)} className={styles.giftButton}>
              🎁
            </button>
          )}
        </footer>
      )}
      {isGiftModalOpen && (
        <GiftModal
          onClose={() => setIsGiftModalOpen(false)}
          onSendGift={handleSendGift}
        />
      )}
      <LeaveConfirmModal
        show={isLeaveModalOpen}
        onConfirm={executeLeaveRoom}
        onCancel={() => setIsLeaveModalOpen(false)}
        details={leaveDetails}
      />
    </div>
  );
}