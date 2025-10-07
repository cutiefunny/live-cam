// app/page.js
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useAuth } from '@/hooks/useAuth';
import useAppStore from '@/store/useAppStore';
import { useSettings } from '@/hooks/useSettings';
import { ref, onValue, off, set, remove, onChildAdded } from 'firebase/database';
import { database } from '@/lib/firebase';
import Header from '@/components/Header';
import ProfileModal from '@/components/ProfileModal';
import styles from './Home.module.css';

// Incoming call modal component
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
  const { user, signIn, isLoading: isAuthLoading, isCreator, goOnline, goOffline, signOut, updateUserProfile } = useAuth();
  const router = useRouter();
  const { creators, setCreators, callRequest, setCallRequest, showToast } = useAppStore();
  const { settings, isLoading: isSettingsLoading } = useSettings();

  const [isOnline, setIsOnline] = useState(false);
  const [userCoins, setUserCoins] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Fetch online creators
  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      const creatorList = data ? Object.values(data) : [];
      setCreators(creatorList);
      if (user) {
        setIsOnline(creatorList.some(c => c.uid === user.uid));
      }
    });
    return () => off(creatorsRef, 'value', listener);
  }, [setCreators, user]);

  // Fetch user coins
  useEffect(() => {
    if (!user) return;
    const userRef = ref(database, `users/${user.uid}/coins`);
    const listener = onValue(userRef, (snapshot) => {
      setUserCoins(snapshot.val() || 0);
    });
    return () => off(userRef, 'value', listener);
  }, [user]);
  
  // Listen for incoming calls if creator
  useEffect(() => {
    if (!user || !isCreator) return;
    const callRef = ref(database, `calls/${user.uid}`);
    const listener = onChildAdded(callRef, (snapshot) => {
        setCallRequest({ ...snapshot.val(), callId: snapshot.key });
    });
    return () => off(callRef, 'child_added', listener);
  }, [user, isCreator, setCallRequest]);

  const handleCallCreator = async (creator) => {
    if (!user) {
        showToast("로그인 후 이용해주세요.", 'error');
        return;
    }
    
    const minRequiredCoins = (settings.costToStart || 0) + (settings.costPerMinute || 0);
    if (userCoins < minRequiredCoins) {
        showToast(`통화에 필요한 코인이 부족합니다. (최소 ${minRequiredCoins}코인 필요)`, 'error');
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
  
  if (isAuthLoading || isSettingsLoading) {
    return <div className={styles.main}><div>Loading...</div></div>;
  }

  return (
    <>
      <Header 
        user={user} 
        userCoins={userCoins} 
        onAvatarClick={() => setIsProfileModalOpen(true)} 
      />
      <main className={styles.main}>
        {!user ? (
          <div className={styles.loginContainer}>
              <h1 className={styles.loginTitle}>취향캠톡</h1>
              <p className={styles.loginDescription}>관심사 기반 영상 채팅을 시작해보세요.</p>
              <button onClick={signIn} className={styles.loginButton}>
                  Google 계정으로 시작하기
              </button>
          </div>
        ) : (
          <div className={styles.lobbyContainer}>
            {isCreator && (
              isOnline ? (
                <button onClick={goOffline} className={styles.goOfflineButton}>Go Offline</button>
              ) : (
                <button onClick={goOnline} className={styles.createButton}>Go Online</button>
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
                                <button onClick={() => handleCallCreator(creator)} className={styles.callButton}>Call</button>
                            </div>
                        )) 
                    : <p>No other creators are online right now.</p>
                }
            </div>
          </div>
        )}
        <IncomingCallModal 
            callRequest={callRequest}
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
        />
        {isProfileModalOpen && user && (
          <ProfileModal 
            user={user}
            onClose={() => setIsProfileModalOpen(false)}
            onUpdateProfile={updateUserProfile}
            onLogout={signOut}
          />
        )}
      </main>
    </>
  );
}