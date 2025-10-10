// app/room/[roomId]/page.js
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';
import { useCoin } from '@/hooks/useCoin';
import { useCallQuality } from '@/hooks/useCallQuality';
import useAppStore from '@/store/useAppStore';
import { database } from '@/lib/firebase';
import { ref, onValue, off, remove, set, onDisconnect, serverTimestamp as rtdbServerTimestamp, push } from 'firebase/database';

import Video from '@/components/Video';
import Controls from '@/components/Controls';
import LeaveConfirmModal from '@/components/LeaveConfirmModal';
import GiftModal from '@/components/GiftModal';
import CallQualityIndicator from '@/components/CallQualityIndicator';
import styles from './Room.module.css';

const createDummyStream = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, 1, 1);
  const stream = canvas.captureStream();
  stream.getTracks().forEach(track => track.enabled = false);
  return stream;
};

export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();
  
  const { user, isAuthLoading, isCreator, showToast, openRatingModal } = useAppStore();
  const { settings, isLoading: isSettingsLoading } = useSettings();
  const { sendGift } = useCoin();
  
  const [myStream, setMyStream] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  
  const { peer, connections, remoteStreams, callPeer, disconnectAll } = useWebRTC(myStream);
  
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState(null);
  
  const callStartTimeRef = useRef(null);
  const callPartnerRef = useRef(null);
  const callEndedRef = useRef(false);
  const coinDeductionIntervalRef = useRef(null);
  const isLeavingRef = useRef(false);

  const remotePeerId = otherUser?.uid;
  const remoteStream = remotePeerId ? remoteStreams[remotePeerId] : null;
  const callQuality = useCallQuality(remotePeerId ? connections[remotePeerId] : null);

  // 1. Initialize media stream
  useEffect(() => {
    const initStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMyStream(stream);
      } catch (err) {
        showToast('카메라/마이크 접근에 실패하여 관전자 모드로 참여합니다.', 'error');
        setMyStream(createDummyStream());
      }
    };
    initStream();
    return () => {
      if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Firebase RealtimeDB: Join room & listen for users
  useEffect(() => {
    if (!user || !roomId) return;

    const roomUsersRef = ref(database, `rooms/${roomId}/users`);
    const currentUserRef = ref(database, `rooms/${roomId}/users/${user.uid}`);
    
    set(currentUserRef, {
      displayName: user.displayName,
      photoURL: user.photoURL,
      joinTime: rtdbServerTimestamp()
    });
    onDisconnect(currentUserRef).remove();

    const usersListener = onValue(roomUsersRef, (snapshot) => {
      const usersInRoom = snapshot.val();
      if (!usersInRoom || Object.keys(usersInRoom).length < 2) {
        if (callStartTimeRef.current && !isLeavingRef.current) {
          handleLeaveRoom(true); // 상대방이 나갔을 때 바로 방 떠나기
        }
        setOtherUser(null);
        callPartnerRef.current = null;
      } else {
        if (!callStartTimeRef.current) callStartTimeRef.current = Date.now();

        const otherUserId = Object.keys(usersInRoom).find(uid => uid !== user.uid);
        if (otherUserId) {
          const partnerInfo = { uid: otherUserId, ...usersInRoom[otherUserId] };
          setOtherUser(partnerInfo);
          callPartnerRef.current = partnerInfo;
        }
      }
    });

    return () => {
      off(roomUsersRef, 'value', usersListener);
      remove(currentUserRef);
    };
  }, [user, roomId]);

  // 3. WebRTC: Call other user when they join
  useEffect(() => {
    if (peer && otherUser && !connections[otherUser.uid] && !remoteStreams[otherUser.uid]) {
      // 발신자만 전화를 겁니다 (중복 방지)
      if (user.uid > otherUser.uid) {
        console.log(`[RoomPage] Calling ${otherUser.uid}`);
        callPeer(otherUser.uid);
      }
    }
  }, [peer, otherUser, connections, remoteStreams, callPeer, user]);
  
  // 4. Coin Deduction Logic
  useEffect(() => {
    if (isCreator || !remoteStream || !settings) return;

    const { costToStart, costPerMinute, creatorShareRate } = settings;

    const deduct = async (amount, type) => {
      const userCoinRef = doc(firestore, 'users', user.uid);
      const creatorCoinRef = doc(firestore, 'users', callPartnerRef.current.uid);
      const payoutAmount = Math.floor(amount * (creatorShareRate / 100));

      try {
        await firestoreTransaction(firestore, async (transaction) => {
          const userDoc = await transaction.get(userCoinRef);
          const currentCoins = userDoc.data()?.coins || 0;
          if (currentCoins < amount) throw new Error('Not enough coins');
          
          transaction.update(userCoinRef, { coins: currentCoins - amount });
          
          if (type === 'minute') {
            const creatorDoc = await transaction.get(creatorCoinRef);
            const creatorCoins = creatorDoc.data()?.coins || 0;
            transaction.update(creatorCoinRef, { coins: creatorCoins + payoutAmount });
          }
        });
        return true;
      } catch (e) {
        showToast(e.message, 'error');
        handleLeaveRoom(true);
        return false;
      }
    };

    const startDeduction = async () => {
      if (costToStart > 0) {
        const success = await deduct(costToStart, 'start');
        if (!success) return;
      }
      
      coinDeductionIntervalRef.current = setInterval(() => {
        deduct(costPerMinute, 'minute');
      }, 60000);
    };

    startDeduction();

    return () => {
      if (coinDeductionIntervalRef.current) {
        clearInterval(coinDeductionIntervalRef.current);
      }
    };
  }, [isCreator, remoteStream, settings, user, showToast]);
  
  // 5. Leave Room Logic
  const handleLeaveRoom = useCallback((immediate = false) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    
    const duration = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
    
    if (immediate) {
        executeLeaveRoom(duration);
        return;
    }
    
    const { costToStart, costPerMinute } = settings;
    const minutes = Math.floor(duration / 60000);
    const coinsUsed = costToStart + (minutes * costPerMinute);
    
    setLeaveDetails({ duration, coins: coinsUsed });
    setIsLeaveModalOpen(true);
  }, [settings, executeLeaveRoom]);

  const executeLeaveRoom = useCallback((duration) => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;

    disconnectAll();
    if(coinDeductionIntervalRef.current) clearInterval(coinDeductionIntervalRef.current);

    const partnerInfo = callPartnerRef.current;
    if (!isCreator && partnerInfo && duration > 10000) { // 10초 이상 통화 시
        // Firestore에 통화 기록 저장
        const historyRef = collection(firestore, 'call_history');
        addDoc(historyRef, {
            callerId: user.uid,
            callerName: user.displayName,
            calleeId: partnerInfo.uid,
            calleeName: partnerInfo.displayName,
            roomId: roomId,
            timestamp: serverTimestamp(),
            duration: duration
        });
        openRatingModal({ creatorId: partnerInfo.uid, creatorName: partnerInfo.displayName });
    }
    
    router.replace('/');
  }, [disconnectAll, isCreator, openRatingModal, router, roomId, user]);
  
  if (isAuthLoading || isSettingsLoading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      {/* ... Gift Animation Overlay ... */}
      <header className={styles.header}>
        <h1 className={styles.roomInfo}>Room: <span className={styles.roomId}>{roomId}</span></h1>
        {remoteStream && <CallQualityIndicator quality={callQuality} />}
        <button onClick={() => handleLeaveRoom(false)} className={styles.exitButton}>Leave Room</button>
      </header>
      <main className={styles.main}>
        {myStream && (
            <div className={styles.myVideoContainer}>
                <Video stream={myStream} muted={true} />
                <div className={styles.displayName}>{user.displayName} (You)</div>
            </div>
        )}
        {remoteStream && otherUser ? (
          <div className={styles.remoteVideoContainer}>
            <Video 
              stream={remoteStream} 
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
          onSendGift={(gift) => sendGift(user.uid, otherUser.uid, gift, roomId)}
        />
      )}
      <LeaveConfirmModal
        show={isLeaveModalOpen}
        onConfirm={() => executeLeaveRoom(leaveDetails.duration)}
        onCancel={() => { setIsLeaveModalOpen(false); isLeavingRef.current = false; }}
        details={leaveDetails}
        isCreator={isCreator}
        settings={settings}
      />
    </div>
  );
}