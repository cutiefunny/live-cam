// app/room/[roomId]/page.js
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
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
  
  const { myStream, peers, callPeer, setMyStream } = useWebRTC();
  
  const [otherUser, setOtherUser] = useState(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  
  const callEndedRef = useRef(false);
  const callPartnerRef = useRef(null); 
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState(null);
  const callStartTimeRef = useRef(null);

  const remotePeerEntry = otherUser ? peers[otherUser.uid] : null;
  const callQuality = useCallQuality(remotePeerEntry?.call);
  
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    let streamRef = null;
    let peer = null;
    const currentUserRef = ref(database, `rooms/${roomId}/users/${user.uid}`);
    const roomUsersRef = ref(database, `rooms/${roomId}/users`);
    let roomUsersListener = null;

    const setup = async () => {
      const iceServers = await fetch('/api/turn')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch ICE servers');
          return res.json();
        })
        .then(data => data.iceServers)
        .catch(err => {
          console.error("[WebRTC] Could not fetch ICE servers.", err);
          showToast('TURN 서버 연결에 실패했습니다.', 'warn');
          return [{ urls: 'stun:stun.l.google.com:19302' }];
        });

      peer = initializePeer(user, iceServers);
      if (!peer) return;

      try {
        streamRef = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('[RoomPage] Media stream acquired.');
      } catch (err) {
        if (err.name === 'NotFoundError') {
          console.log('[RoomPage] Media device not found, creating dummy stream.');
          showToast('카메라/마이크를 찾을 수 없습니다. 관전자 모드로 참여합니다.', 'info');
        } else {
          console.error("[RoomPage] getUserMedia error:", err);
          showToast('카메라/마이크 접근에 실패했습니다.', 'error');
        }
        streamRef = createDummyStream();
      }
      setMyStream(streamRef);

      set(currentUserRef, {
        displayName: user.displayName, photoURL: user.photoURL, email: user.email,
        joinTime: rtdbServerTimestamp()
      });
      onDisconnect(currentUserRef).remove();

      roomUsersListener = onValue(roomUsersRef, (snapshot) => {
        const usersInRoom = snapshot.val();
        if (usersInRoom && !callStartTimeRef.current) callStartTimeRef.current = Date.now();
        if (!usersInRoom) { executeLeaveRoom(); return; }

        const otherUserId = Object.keys(usersInRoom).find(uid => uid !== user.uid);
        if (otherUserId) {
            const partnerInfo = { uid: otherUserId, ...usersInRoom[otherUserId] };
            setOtherUser(partnerInfo);
            callPartnerRef.current = partnerInfo;
        } else {
            setOtherUser(null);
            callPartnerRef.current = null;
            if (callStartTimeRef.current) executeLeaveRoom();
        }
      });
    };

    setup();

    return () => {
      console.log('[Cleanup] Leaving room component.');
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
      if (roomUsersListener) {
        off(roomUsersRef, 'value', roomUsersListener);
      }
      remove(currentUserRef);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user, roomId]);

  useEffect(() => {
    const handleBeforeUnload = () => destroyPeer();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      destroyPeer();
    };
  }, []);
  
  useEffect(() => {
    if (myStream && userVideo.current) {
      userVideo.current.srcObject = myStream;
    }
  }, [myStream]);
  
  useEffect(() => {
    if (myStream && otherUser && !peers[otherUser.uid] && !isCreator && user && user.uid > otherUser.uid) {
        console.log(`[RoomPage] My UID is greater. Attempting to call ${otherUser.uid}`);
        callPeer(otherUser.uid);
    }
  }, [myStream, otherUser, peers, callPeer, isCreator, user]);
  
  const executeLeaveRoom = useCallback(() => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    
    const partnerInfo = callPartnerRef.current;
    if (!isCreator && partnerInfo) {
      openRatingModal({ 
        creatorId: partnerInfo.uid, 
        creatorName: partnerInfo.displayName 
      });
    }
    router.replace('/');
  }, [isCreator, router, openRatingModal]);
  
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
    const backPressState = { pressedOnce: false, timeoutId: null };
    history.pushState(null, '', location.href);
    const handlePopState = () => {
      history.pushState(null, '', location.href);
      if (backPressState.pressedOnce) {
        if (backPressState.timeoutId) clearTimeout(backPressState.timeoutId);
        handleLeaveRoom();
      } else {
        backPressState.pressedOnce = true;
        showToast('한 번 더 누르면 통화가 종료됩니다.', 'info');
        backPressState.timeoutId = setTimeout(() => {
          backPressState.pressedOnce = false;
        }, 2000);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <button onClick={handleLeaveRoom} className={styles.exitButton}>Leave Room</button>
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