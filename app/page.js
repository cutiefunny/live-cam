// app/page.js
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useAuth } from '@/hooks/useAuth';
import useAppStore from '@/store/useAppStore';
import { ref, onValue, off, set, remove, onChildAdded } from 'firebase/database';
import { database } from '@/lib/firebase';
import styles from './Home.module.css';

// 통화 수신 모달 컴포넌트
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
  const { user, signIn, isLoading, isCreator, goOnline, goOffline } = useAuth();
  const router = useRouter();
  const { creators, setCreators, callRequest, setCallRequest, showToast } = useAppStore();

  const [isOnline, setIsOnline] = useState(false);
  const [userCoins, setUserCoins] = useState(0);

  // 온라인 크리에이터 목록 가져오기 및 현재 내 상태 업데이트
  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      const creatorList = data ? Object.values(data) : [];
      setCreators(creatorList);
      
      if (user) {
        const amIOnline = creatorList.some(c => c.uid === user.uid);
        setIsOnline(amIOnline);
      }
    });
    return () => off(creatorsRef, 'value', listener);
  }, [setCreators, user]);

  // 현재 사용자의 코인 정보 실시간으로 가져오기
  useEffect(() => {
    if (!user) return;

    const userRef = ref(database, `users/${user.uid}/coins`);
    const listener = onValue(userRef, (snapshot) => {
      setUserCoins(snapshot.val() || 0);
    });

    return () => off(userRef, 'value', listener);
  }, [user]);
  
  // 크리에이터인 경우 통화 요청 리스닝
  useEffect(() => {
    if (!user || !isCreator) return;

    const callRef = ref(database, `calls/${user.uid}`);
    const listener = onChildAdded(callRef, (snapshot) => {
        const callData = snapshot.val();
        setCallRequest({ ...callData, callId: snapshot.key });
    });

    return () => off(callRef, 'child_added', listener);
  }, [user, isCreator, setCallRequest]);

  const handleCallCreator = async (creator) => {
    if (!user) {
        showToast("로그인 후 이용해주세요.", 'error');
        return;
    }
    if (creator.uid === user.uid) {
        showToast("자기 자신에게는 통화를 걸 수 없습니다.", 'info');
        return;
    }
    if (creator.status !== 'online') {
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
    
    const creatorStatusRef = ref(database, `creators/${user.uid}/status`);
    await set(creatorStatusRef, 'busy');

    const { roomId, requesterId } = callRequest;
    const callRef = ref(database, `calls/${user.uid}/${requesterId}`);
    
    await remove(callRef);
    setCallRequest(null);

    router.push(`/room/${roomId}`);
  };

  const handleDeclineCall = async () => {
      if (!callRequest || !user) return;
      const callRef = ref(database, `calls/${user.uid}/${callRequest.requesterId}`);
      await remove(callRef);
      setCallRequest(null);
  };
  
  if (isLoading) {
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
    <main className={styles.main}>
        <div className={styles.lobbyContainer}>
            <div className={styles.userInfo}>
                <img src={user.photoURL} alt={user.displayName} className={styles.userAvatar} />
                <div>
                  <span>Welcome, {user.displayName} {isCreator && '(Creator)'}</span>
                  <div className={styles.coinInfo}>💰 {userCoins} Coins</div>
                </div>
            </div>
            
            {isCreator && (
              isOnline ? (
                <button onClick={goOffline} className={styles.goOfflineButton}>
                    Go Offline
                </button>
              ) : (
                <button onClick={goOnline} className={styles.createButton}>
                    Go Online
                </button>
              )
            )}

            <h2 className={styles.creatorListTitle}>Online Creators</h2>
            <div className={styles.creatorList}>
                {creators.filter(c => c.status === 'online' && c.uid !== user.uid).length > 0 ? 
                    creators
                        .filter(creator => creator.status === 'online' && creator.uid !== user.uid)
                        .map(creator => (
                            <div key={creator.uid} className={styles.creatorItem}>
                                <div className={styles.creatorInfo}>
                                <img src={creator.photoURL} alt={creator.displayName} className={styles.creatorAvatar} />
                                <span>{creator.displayName}</span>
                                </div>
                                <button onClick={() => handleCallCreator(creator)} className={styles.callButton}>
                                    Call
                                </button>
                            </div>
                        )) 
                    : (
                    <p>No other creators are online right now.</p>
                )}
            </div>
        </div>
        <IncomingCallModal 
            callRequest={callRequest}
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
        />
    </main>
  );
}