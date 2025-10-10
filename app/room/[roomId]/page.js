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
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';
import { useCallQuality } from '@/hooks/useCallQuality';
import useAppStore from '@/store/useAppStore';
import styles from './Room.module.css';
// ✨ [수정] 'serverTimestamp'를 RTDB에서 가져옵니다.
import { ref, onValue, off, remove, set, get, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { database, firestore } from '@/lib/firebase';


export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();
  const { sendGift } = useCoin();
  
  const user = useAppStore((state) => state.user);
  const isAuthLoading = useAppStore((state) => state.isAuthLoading);
  const isCreator = useAppStore((state) => state.isCreator);
  const giftAnimation = useAppStore((state) => state.giftAnimation);
  const setGiftAnimation = useAppStore((state) => state.setGiftAnimation);
  const showToast = useAppStore((state) => state.showToast);

  const { settings, isLoading: isSettingsLoading } = useSettings();
  const userVideo = useRef();
  
  const { peer, myStream, peers, callPeer, setMyStream } = useWebRTC(user, roomId);
  
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
    if (!user || !roomId) return;
    
    const currentUserRef = ref(database, `rooms/${roomId}/users/${user.uid}`);
    set(currentUserRef, {
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
      // ✨ [추가] 서버에서 통화 시작 시간을 기록할 수 있도록 joinTime을 설정합니다.
      joinTime: rtdbServerTimestamp()
    });
    onDisconnect(currentUserRef).remove();

    const roomUsersRef = ref(database, `rooms/${roomId}/users`);
    const listener = onValue(roomUsersRef, (snapshot) => {
        const usersInRoom = snapshot.val();

        if (usersInRoom && !callStartTimeRef.current) {
          callStartTimeRef.current = Date.now();
        }

        if (!usersInRoom && callStarted) {
            executeLeaveRoom();
            return;
        }

        if (usersInRoom) {
            const otherUserId = Object.keys(usersInRoom).find(uid => uid !== user.uid);
            if (otherUserId) {
                const partnerInfo = { uid: otherUserId, ...usersInRoom[otherUserId] };
                setOtherUser(partnerInfo);
                callPartnerRef.current = partnerInfo;
                if (!callStarted) setCallStarted(true);
            } else {
                setOtherUser(null);
                callPartnerRef.current = null;
                if (callStarted) {
                    executeLeaveRoom();
                }
            }
        }
    });

    return () => {
      off(roomUsersRef, 'value', listener);
      remove(currentUserRef).then(() => {
        get(roomUsersRef).then((snapshot) => {
            if (!snapshot.exists()) {
                remove(ref(database, `rooms/${roomId}`));
            }
        });
      });
    };
  }, [user, roomId, callStarted]); // ✨ 의존성 배열 단순화

  useEffect(() => {
    if (isAuthLoading || !user) {
      if (!isAuthLoading) router.push('/');
      return;
    }
  
    let streamRef = null;
    let isEffectActive = true;
  
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (isEffectActive) {
          streamRef = stream;
          setMyStream(stream);
        }
      })
      .catch(err => {
        if (isEffectActive) {
          console.error("[RoomPage] getUserMedia error.", err);
          showToast('카메라/마이크 접근에 실패했습니다. 관전자 모드로 참여합니다.', 'error');
        }
      });
  
    return () => {
      isEffectActive = false;
      if (streamRef) {
        console.log('[Cleanup] Stopping media tracks.');
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  }, [isAuthLoading, user, router, setMyStream, showToast]);

  useEffect(() => {
    if (myStream && userVideo.current) {
      userVideo.current.srcObject = myStream;
    }
  }, [myStream]);
  
  useEffect(() => {
    if (peer && myStream && otherUser && !peers[otherUser.uid] && !isCreator) {
        console.log(`[RoomPage] Attempting to call ${otherUser.uid}`);
        callPeer(otherUser.uid);
    }
  }, [peer, myStream, otherUser, peers, callPeer, isCreator]);

  // ✨ [제거] 클라이언트 측 코인 차감 및 통화 기록 로직을 모두 제거합니다.
  // 이 로직은 이제 위에서 추가한 `finalizeCall` Firebase Function이 처리합니다.
  
  const executeLeaveRoom = () => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    if (backPressState.current.timeoutId) clearTimeout(backPressState.current.timeoutId);
    window.onpopstate = null; 
    const partnerInfo = callPartnerRef.current;
    if (!isCreator && partnerInfo) {
      const query = `?callEnded=true&creatorId=${partnerInfo.uid}&creatorName=${partnerInfo.displayName}`;
      router.replace(`/${query}`);
    } else {
      router.replace('/');
    }
  };
  
  const handleLeaveRoom = () => {
    // ✨ [수정] 통화 종료 시, 서버가 정산할 것이므로 클라이언트에서는 간단한 정보만 표시합니다.
    if (!callStartTimeRef.current) {
        executeLeaveRoom();
        return;
    }
    const duration = Date.now() - callStartTimeRef.current;
    // 코인 정보는 더 이상 계산하지 않고, 통화 시간만 전달합니다.
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

  useEffect(() => {
    if (giftAnimation) {
      const timer = setTimeout(() => setGiftAnimation(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [giftAnimation, setGiftAnimation]);

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
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spectatorIcon}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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