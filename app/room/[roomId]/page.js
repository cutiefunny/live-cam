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
import { ref, onValue, off, remove, set, get, onDisconnect } from 'firebase/database';
import { doc, runTransaction, addDoc, collection, serverTimestamp } from 'firebase/firestore'; // ✨ [추가]
import { database, firestore } from '@/lib/firebase'; // ✨ [수정]


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
  const coinDeductionIntervalRef = useRef(null);
  
  const callEndedRef = useRef(false);
  const backPressState = useRef({ pressedOnce: false, timeoutId: null });
  const callPartnerRef = useRef(null); 

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState(null);
  const callStartTimeRef = useRef(null);
  const minutesChargedRef = useRef(0);

  const remotePeerEntry = otherUser ? peers[otherUser.uid] : null;
  const callQuality = useCallQuality(remotePeerEntry?.call);
  const [callStarted, setCallStarted] = useState(false);

  // ... (방 입장/퇴장 로직은 이전 답변과 동일) ...
  useEffect(() => {
    if (!user || !roomId) return;
    
    const currentUserRef = ref(database, `rooms/${roomId}/users/${user.uid}`);
    set(currentUserRef, {
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email
    });
    onDisconnect(currentUserRef).remove();

    const roomUsersRef = ref(database, `rooms/${roomId}/users`);
    const listener = onValue(roomUsersRef, (snapshot) => {
        const usersInRoom = snapshot.val();

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
  }, [user, roomId, callStarted]);

  // ... (미디어 스트림 관련 로직은 이전 답변과 동일) ...
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

  // ✨ [수정] 코인 차감 및 통화 기록 로직 (Firestore 사용)
  useEffect(() => {
    if (!remotePeerEntry || !settings || isCreator || !user) {
        if (remotePeerEntry === null) {
            callStartTimeRef.current = null;
            minutesChargedRef.current = 0;
        }
      return;
    }
  
    if (!callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
    }

    const remotePeerId = remotePeerEntry.call.peer;
    const partnerInfo = callPartnerRef.current;
    if (!partnerInfo) return;

    console.log(`[Coin] Call with ${remotePeerId} is active. Starting coin logic.`);
    const startTime = callStartTimeRef.current;
  
    const { costToStart, costPerMinute } = settings;
  
    (async () => {
      if (costToStart > 0) {
        await deductCoin(user.uid, remotePeerId, costToStart, '통화 시작');
      }
    })();
  
    const intervalId = setInterval(() => {
      deductCoin(user.uid, remotePeerId, costPerMinute, `Video call minute charge`);
      minutesChargedRef.current += 1;
    }, 60000);
    coinDeductionIntervalRef.current = intervalId;
  
    return () => {
      console.log(`[Coin] Call with ${remotePeerId} ended. Cleaning up.`);
      clearInterval(coinDeductionIntervalRef.current);
      coinDeductionIntervalRef.current = null;
      
      const duration = Date.now() - startTime;
      
      addDoc(collection(firestore, 'call_history'), {
          callerId: user.uid, callerName: user.displayName,
          calleeId: partnerInfo.uid, calleeName: partnerInfo.displayName,
          roomId: roomId, timestamp: new Date(startTime), duration
      });
      console.log(`[History] Call record saved to Firestore. Duration: ${duration}ms`);
    };
  
  }, [remotePeerEntry, settings, isCreator, user]);

  const payoutToCreator = (creatorId, amount) => {
    const creatorDocRef = doc(firestore, 'users', creatorId);
    return runTransaction(firestore, async (transaction) => {
        const creatorDoc = await transaction.get(creatorDocRef);
        if (!creatorDoc.exists()) return;
        const newCoins = (creatorDoc.data().coins || 0) + amount;
        transaction.update(creatorDocRef, { coins: newCoins });
    });
  };
  
  const deductCoin = async (userId, peerId, amount, description) => {
    const userDocRef = doc(firestore, 'users', userId);
    try {
        await runTransaction(firestore, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("User document does not exist!");

            const currentCoins = userDoc.data().coins || 0;
            if (currentCoins < amount) {
                throw new Error("Not enough coins");
            }
            transaction.update(userDocRef, { coins: currentCoins - amount });
        });

        if (description !== '통화 시작' && settings) {
            const payoutAmount = Math.floor(amount * (settings.creatorShareRate / 100));
            await payoutToCreator(peerId, payoutAmount);
        }
        
        await addDoc(collection(firestore, 'coin_history'), {
            userId, userEmail: user.email, userName: user.displayName, type: 'use', 
            amount, timestamp: serverTimestamp(), description: `${description} (${peerId})`
        });
        return true;
    } catch (error) {
        console.error("Coin deduction failed:", error.message);
        showToast(error.message === "Not enough coins" ? '코인이 부족하여 통화를 종료합니다.' : '코인 차감 오류', 'error');
        executeLeaveRoom();
        return false;
    }
  };
  
  // ... (방 나가기, 뒤로가기, 선물 관련 핸들러 및 useEffect는 이전 답변과 동일) ...
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
    if (!callStartTimeRef.current) {
        executeLeaveRoom();
        return;
    }
    const duration = Date.now() - callStartTimeRef.current;
    const details = { duration, isCreator, coins: 0, fee: 0 };
    if (settings) {
      const perMinuteCost = settings.costPerMinute || 0;
      const startCost = settings.costToStart || 0;
      const shareRate = settings.creatorShareRate || 0;
      const minutes = minutesChargedRef.current;

      if (isCreator) {
          const payoutPerMinute = Math.floor(perMinuteCost * (shareRate / 100));
          const coinsEarned = minutes * payoutPerMinute;
          const totalRevenue = startCost + (minutes * perMinuteCost);
          details.coins = coinsEarned;
          details.fee = totalRevenue - coinsEarned;
      } else {
          details.coins = startCost + (minutes * perMinuteCost);
      }
    }
    setLeaveDetails(details);
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
  }, [showToast, handleLeaveRoom]);

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
  
  // ... (로딩 및 JSX 렌더링 부분은 이전 답변과 동일) ...
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