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

// ✨ [추가] 별점 표시 컴포넌트
const StarRating = ({ rating }) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
    <div className={styles.starRating}>
      {[...Array(fullStars)].map((_, i) => <span key={`full-${i}`}>★</span>)}
      {halfStar && <span>☆</span>} {/* 간단하게 비어있는 별로 대체 */}
      {[...Array(emptyStars)].map((_, i) => <span key={`empty-${i}`}>☆</span>)}
      <span className={styles.ratingValue}>{rating.toFixed(1)}</span>
    </div>
  );
};


export default function CreatorProfilePage() {
  const router = useRouter();
  const { creatorId } = useParams();
  const { user, openCoinModal, openProfileModal } = useAppStore();

  const [creatorInfo, setCreatorInfo] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState({ bio: '', averageRating: 0, ratingCount: 0 }); // ✨ [수정]
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBio, setEditingBio] = useState('');

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

  const openEditModal = () => {
    setEditingBio(creatorProfile.bio || '');
    setIsEditModalOpen(true);
  };
  
  const handleSaveProfile = async () => {
    if (!creatorId) return;
    try {
      const profileRef = ref(database, `creator_profiles/${creatorId}`);
      // ✨ [수정] bio 외에 다른 정보가 있다면 유지하도록 ...creatorProfile 추가
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
            {/* ✨ [추가] 별점 및 평가 수 표시 */}
            {creatorProfile.ratingCount > 0 && (
              <div className={styles.ratingContainer}>
                <StarRating rating={creatorProfile.averageRating} />
                <span className={styles.ratingCount}>({creatorProfile.ratingCount}개의 평가)</span>
              </div>
            )}
            {isOwner && (
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
          bio={editingBio}
          onBioChange={setEditingBio}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </>
  );
}