// app/creator/[creatorId]/page.js
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, off, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';
import Header from '@/components/Header';
import CreatorProfileEditModal from '@/components/CreatorProfileEditModal';
import styles from './CreatorProfile.module.css';

export default function CreatorProfilePage() {
  const router = useRouter();
  const { creatorId } = useParams();
  const { user, openCoinModal, openProfileModal } = useAppStore();

  const [creatorInfo, setCreatorInfo] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState({ bio: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBio, setEditingBio] = useState(''); // ✨ [추가] 모달의 bio 상태를 부모에서 관리

  useEffect(() => {
    if (!creatorId) return;

    const userRef = ref(database, `users/${creatorId}`);
    const profileRef = ref(database, `creator_profiles/${creatorId}`);

    const userListener = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setCreatorInfo(snapshot.val());
      } else {
        router.push('/');
      }
      setIsLoading(false);
    });

    const profileListener = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        setCreatorProfile(snapshot.val());
      }
    });

    return () => {
      off(userRef, 'value', userListener);
      off(profileRef, 'value', profileListener);
    };
  }, [creatorId, router]);

  // ✨ [추가] 모달을 열 때, 현재 프로필 bio를 모달 편집용 state에 설정
  const openEditModal = () => {
    setEditingBio(creatorProfile.bio || '');
    setIsEditModalOpen(true);
  };
  
  // ✨ [수정] 모달로부터 newBio를 인자로 받지 않고, 부모의 editingBio 상태를 사용
  const handleSaveProfile = async () => {
    if (!creatorId) return;
    try {
      const profileRef = ref(database, `creator_profiles/${creatorId}`);
      await set(profileRef, {
        ...creatorProfile,
        bio: editingBio,
      });
      useAppStore.getState().showToast('프로필이 성공적으로 저장되었습니다.', 'success');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
      useAppStore.getState().showToast('프로필 저장에 실패했습니다.', 'error');
    }
  };

  if (isLoading || !creatorInfo) {
    return <div>Loading...</div>;
  }
  
  const isOwner = user && user.uid === creatorId;

  return (
    <>
      <Header 
        user={user} 
        userCoins={useAppStore.getState().userCoins}
        onAvatarClick={openProfileModal}
        onCoinClick={openCoinModal}
      />
      <main className={styles.main}>
        <div className={styles.profileContainer}>
          <div className={styles.profileHeader}>
            <img src={creatorInfo.photoURL || '/images/icon.png'} alt={creatorInfo.displayName} className={styles.profileAvatar} />
            <h1 className={styles.displayName}>{creatorInfo.displayName}</h1>
            {isOwner && (
              // ✨ [수정] 모달 여는 함수 변경
              <button onClick={openEditModal} className={styles.editButton}>
                프로필 수정
              </button>
            )}
          </div>
          <div className={styles.profileBody}>
            <h2 className={styles.sectionTitle}>소개</h2>
            <p className={styles.bio}>
              {creatorProfile.bio || (isOwner ? '소개글을 작성해주세요.' : '작성된 소개가 없습니다.')}
            </p>
          </div>
        </div>
      </main>
      {isEditModalOpen && (
        <CreatorProfileEditModal
          // ✨ [수정] 모달에 상태와 상태 변경 함수를 props로 전달
          bio={editingBio}
          onBioChange={setEditingBio}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </>
  );
}