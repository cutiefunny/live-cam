// app/page.js
'use client';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCreator } from '@/hooks/useCreator';
import { useCoin } from '@/hooks/useCoin';
import { useSettings } from '@/hooks/useSettings';
import useAppStore from '@/store/useAppStore';
import { ref, onValue, off, set, remove, onChildAdded } from 'firebase/database';
import { collection, onSnapshot, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { database, firestore } from '@/lib/firebase';
import styles from './Home.module.css';
import Header from '@/components/Header';
import ProfileModal from '@/components/ProfileModal';
import CoinModal from '@/components/CoinModal';
import RatingModal from '@/components/RatingModal';
import CreatorList from '@/components/CreatorList';
import FollowingList from '@/components/FollowingList';

// ... (IncomingCallModal, RatingTrigger 컴포넌트는 변경 없음) ...
const IncomingCallModal = ({ callRequest, onAccept, onDecline }) => {
    if (!callRequest) return null;
    const { requesterName, requesterPhotoURL } = callRequest;
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <h2>Incoming Call</h2>
                <img src={requesterPhotoURL} alt={requesterName} className={styles.modalProfileImage} />
                <p><strong>{requesterName}</strong> is calling you.</p>
                <div className={styles.modalActions}>
                    <button onClick={onAccept} className={styles.acceptButton}>Accept</button>
                    <button onClick={onDecline} className={styles.declineButton}>Decline</button>
                </div>
            </div>
        </div>
    );
};

export default function Home() {
  const { signIn, signOut } = useAuth();
  const { updateUserProfile } = useUserProfile();
  const { goOnline, goOffline, isOnline } = useCreator();
  const { requestCoinCharge } = useCoin();
  const { settings, isLoading: isSettingsLoading } = useSettings();
  const router = useRouter();

  const {
    user, isAuthLoading, isCreator, creators, setCreators,
    callRequest, setCallRequest, userCoins, setUserCoins,
    isProfileModalOpen, openProfileModal, closeProfileModal,
    isCoinModalOpen, openCoinModal, closeCoinModal, showToast, following,
  } = useAppStore();

  const [rankedCreators, setRankedCreators] = useState([]);

  // 온라인 크리에이터 목록 (실시간) - RealtimeDB
  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      const creatorList = data ? Object.values(data) : [];
      setCreators(creatorList);
    });
    return () => off(creatorsRef, 'value', listener);
  }, [setCreators]);

  // ✨ [수정] Firestore 쿼리에서 orderBy를 제거하고 클라이언트에서 정렬합니다.
  useEffect(() => {
    const creatorsQuery = query(
      collection(firestore, 'users'),
      where('isCreator', '==', true),
      limit(10) // 정렬은 제거하고 limit만 유지
    );
    
    const unsubscribeCreators = onSnapshot(creatorsQuery, (snapshot) => {
      const onlineCreatorIds = new Set(creators.map(c => c.uid));
      const creatorList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        isOnline: onlineCreatorIds.has(doc.id)
      }));

      // 클라이언트 측에서 totalCallTime을 기준으로 정렬 (필드가 없으면 0으로 간주)
      creatorList.sort((a, b) => (b.totalCallTime || 0) - (a.totalCallTime || 0));

      setRankedCreators(creatorList);
    }, (error) => {
      // 에러 핸들링 추가
      console.error("크리에이터 목록 조회 중 에러 발생:", error);
      showToast("크리에이터 목록을 불러오는 데 실패했습니다.", "error");
    });

    return () => unsubscribeCreators();
  }, [creators, showToast]); // 의존성 배열에 showToast 추가

  // 사용자 코인 정보 실시간 구독 - Firestore
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      setUserCoins(doc.data()?.coins || 0);
    });
    return () => unsubscribe();
  }, [user, setUserCoins]);
  
  // 통화 요청 수신 (실시간) - RealtimeDB
  useEffect(() => {
    if (!user || !isCreator) return;
    const callRef = ref(database, `calls/${user.uid}`);
    const listener = onChildAdded(callRef, (snapshot) => {
        const callData = snapshot.val();
        setCallRequest({ ...callData, callId: snapshot.key });
    });
    return () => off(callRef, 'child_added', listener);
  }, [user, isCreator, setCallRequest]);
  
  // 팔로우 중인 크리에이터 목록 계산
  const followingCreators = useMemo(() => {
    if (rankedCreators.length === 0 || following.length === 0) {
      return [];
    }
  
    const followingCreatorIds = new Set(following);
    return rankedCreators
      .filter(c => followingCreatorIds.has(c.uid))
      .sort((a, b) => b.isOnline - a.isOnline);
  }, [rankedCreators, following]);

  // ... (handleCallCreator, handleAcceptCall, handleDeclineCall 및 렌더링 로직은 변경 없음) ...
    const handleCallCreator = async (creator) => {
    if (!user) {
      showToast("로그인 후 이용해주세요.", 'error');
      return;
    }
    const totalCost = (settings?.costToStart || 0) + (settings?.costPerMinute || 10);
    if (userCoins < totalCost) {
      showToast(`통화에 필요한 코인이 부족합니다. (최소 ${totalCost}코인 필요)`, 'error');
      return;
    }
    if (creator.uid === user.uid) {
      showToast("자기 자신에게는 통화를 걸 수 없습니다.", 'info');
      return;
    }
    if (!creator.isOnline) {
      showToast("현재 통화할 수 없는 상태입니다.", 'info');
      return;
    }

    const newRoomId = nanoid(7);
    const callRef = ref(database, `calls/${creator.uid}/${user.uid}`);
    await set(callRef, {
        roomId: newRoomId,
        requesterId: user.uid,
        requesterName: user.displayName,
        requesterPhotoURL: user.photoURL,
        timestamp: Date.now(),
    });
    router.push(`/room/${newRoomId}`);
  };

  const handleAcceptCall = async () => {
    if (!callRequest || !user) return;
    await set(ref(database, `creators/${user.uid}/status`), 'busy');
    const { roomId, requesterId } = callRequest;
    await remove(ref(database, `calls/${user.uid}/${requesterId}`));
    setCallRequest(null);
    router.push(`/room/${roomId}`);
  };

  const handleDeclineCall = async () => {
    if (!callRequest || !user) return;
    await remove(ref(database, `calls/${user.uid}/${callRequest.requesterId}`));
    setCallRequest(null);
  };
  
  // ... 나머지 렌더링 로직 ...
  if (isAuthLoading || isSettingsLoading) {
    return <div className={styles.main}><div>Loading...</div></div>;
  }

  if (!user) {
    return (
      <main className={styles.main}>
        <div className={styles.loginContainer}>
            <h1 className={styles.loginTitle}>취향캠톡</h1>
            <p className={styles.loginDescription}>관심사 기반 영상 채팅을 시작해보세요.</p>
            <button onClick={signIn} className={styles.loginButton}>
                Google 계정으로 시작하기
            </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header 
        user={user} 
        userCoins={userCoins}
        onAvatarClick={openProfileModal}
        onCoinClick={openCoinModal}
      />

      <main className={styles.main}>
        {isCreator && (
            <div className={styles.creatorActions}>
                {isOnline ? (
                <button onClick={goOffline} className={styles.goOfflineButton}>Go Offline</button>
                ) : (
                <button onClick={goOnline} className={styles.createButton}>Go Online</button>
                )}
            </div>
        )}
        
        {followingCreators.length > 0 && (
          <FollowingList 
            followingCreators={followingCreators}
            user={user}
            onCallCreator={handleCallCreator}
          />
        )}
        
        <CreatorList
          rankedCreators={rankedCreators}
          user={user}
          onCallCreator={handleCallCreator}
        />

        <IncomingCallModal callRequest={callRequest} onAccept={handleAcceptCall} onDecline={handleDeclineCall} />
        {isProfileModalOpen && (
          <ProfileModal 
            user={user}
            onClose={closeProfileModal}
            onUpdateProfile={updateUserProfile}
            onLogout={signOut}
          />
        )}
        {isCoinModalOpen && (
          <CoinModal
            onClose={closeCoinModal}
            onRequestCharge={requestCoinCharge}
          />
        )}
        <RatingModal />
      </main>
    </>
  );
}