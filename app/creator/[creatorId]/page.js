// app/creator/[creatorId]/page.js
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, off, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCreator } from '@/hooks/useCreator';
import Header from '@/components/Header';
import CreatorProfileEditModal from '@/components/CreatorProfileEditModal';
import CreatorPhotoGallery from '@/components/creator/CreatorPhotoGallery';
import PhotoUploadModal from '@/components/creator/PhotoUploadModal';
import styles from './CreatorProfile.module.css';

const StarRating = ({ rating }) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  
    return (
      <div className={styles.starRating}>
        {[...Array(fullStars)].map((_, i) => <span key={`full-${i}`}>★</span>)}
        {halfStar && <span>☆</span>}
        {[...Array(emptyStars)].map((_, i) => <span key={`empty-${i}`}>☆</span>)}
        <span className={styles.ratingValue}>{rating.toFixed(1)}</span>
      </div>
    );
};

export default function CreatorProfilePage() {
  const router = useRouter();
  const { creatorId } = useParams();
  const { user, openCoinModal, openProfileModal, showToast, following } = useAppStore();
  const { toggleFollowCreator } = useUserProfile();
  const { uploadCreatorPhotos, deleteCreatorPhoto } = useCreator();


  const [creatorInfo, setCreatorInfo] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState({ bio: '', averageRating: 0, ratingCount: 0, photos: null });
  const [followers, setFollowers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingBio, setEditingBio] = useState('');

  const isFollowing = useMemo(() => following.includes(creatorId), [following, creatorId]);

  useEffect(() => {
    if (!creatorId) return;

    const userRef = ref(database, `users/${creatorId}`);
    const profileRef = ref(database, `creator_profiles/${creatorId}`);
    const followersRef = ref(database, `users/${creatorId}/followers`);

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
    
    const followersListener = onValue(followersRef, (snapshot) => {
        setFollowers(snapshot.val() ? Object.keys(snapshot.val()) : []);
    });

    return () => {
      off(userRef, 'value', userListener);
      off(profileRef, 'value', profileListener);
      off(followersRef, 'value', followersListener);
    };
  }, [creatorId, router]);

  const handleFollowToggle = () => {
    toggleFollowCreator(creatorId);
  };
  
  const openEditModal = () => {
    setEditingBio(creatorProfile.bio || '');
    setIsEditModalOpen(true);
  };
  
  const handleSaveProfile = async () => {
    if (!creatorId) return;
    try {
      const profileRef = ref(database, `creator_profiles/${creatorId}`);
      await set(profileRef, {
        ...creatorProfile,
        bio: editingBio,
      });
      showToast('프로필이 성공적으로 저장되었습니다.', 'success');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
      showToast('프로필 저장에 실패했습니다.', 'error');
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (window.confirm('사진을 정말 삭제하시겠습니까?')) {
      try {
        await deleteCreatorPhoto(photoId);
        showToast('사진이 삭제되었습니다.', 'success');
      } catch (error) {
        showToast('사진 삭제에 실패했습니다.', 'error');
        console.error("Failed to delete photo:", error);
      }
    }
  };
  
  const photoList = useMemo(() => {
    if (!creatorProfile.photos) return [];
    
    const photosData = creatorProfile.photos;
    const photosArray = Array.isArray(photosData) ? photosData : Object.values(photosData);
    
    return photosArray.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [creatorProfile.photos]);


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
          {/* ✨ [수정] 프로필 헤더 JSX 구조 변경 */}
          <div className={styles.profileHeader}>
            <div className={styles.profileAvatarContainer}>
              <img src={creatorInfo.photoURL || '/images/icon.png'} alt={creatorInfo.displayName} className={styles.profileAvatar} />
            </div>

            <div className={styles.profileInfoContainer}>
              <h1 className={styles.displayName}>{creatorInfo.displayName}</h1>
              
              <div className={styles.profileStats}>
                  {creatorProfile.ratingCount > 0 && (
                    <div className={styles.ratingContainer}>
                      <StarRating rating={creatorProfile.averageRating} />
                      <span className={styles.ratingCount}>({creatorProfile.ratingCount})</span>
                    </div>
                  )}
                  <div className={styles.followerContainer}>
                    <span className={styles.followerCount}>팔로워 {followers.length}</span>
                  </div>
              </div>

              {isOwner ? (
                <button onClick={openEditModal} className={styles.editButton}>
                  소개 수정
                </button>
              ) : user && (
                  <button onClick={handleFollowToggle} className={isFollowing ? styles.unfollowButton : styles.followButton}>
                      {isFollowing ? '언팔로우' : '팔로우'}
                  </button>
              )}
            </div>
          </div>

          <div className={styles.profileBody}>
            <p className={styles.bio}>
              {creatorProfile.bio || (isOwner ? '소개글을 작성해주세요.' : '작성된 소개가 없습니다.')}
            </p>
          </div>
          <CreatorPhotoGallery
            photos={photoList}
            isOwner={isOwner}
            onAddPhoto={() => setIsUploadModalOpen(true)}
            onDeletePhoto={handleDeletePhoto}
          />
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
      {isUploadModalOpen && (
        <PhotoUploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={uploadCreatorPhotos}
        />
      )}
    </>
  );
}