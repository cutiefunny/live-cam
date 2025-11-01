// app/page.js
'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCoin } from '@/hooks/useCoin';
import useAppStore from '@/store/useAppStore';
import styles from './Home.module.css';
import Header from '@/components/Header';
import ProfileModal from '@/components/ProfileModal';
import CoinModal from '@/components/CoinModal';
import RatingModal from '@/components/RatingModal';
// ✨ [수정] Swiper 임포트
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/autoplay';
// ✨ [수정] 신규 훅 임포트
import { useMatchingUsers } from '@/hooks/useMatchingUsers';
import Image from 'next/image'; // ✨ [수정] Image 컴포넌트

// ✨ [수정] RatingTrigger 위치 page.js 내부로 이동
function RatingTrigger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openRatingModal } = useAppStore();

  useEffect(() => {
    const callEnded = searchParams.get('callEnded');
    const creatorId = searchParams.get('creatorId');
    const creatorName = searchParams.get('creatorName');

    if (callEnded === 'true' && creatorId && creatorName) {
      openRatingModal({ creatorId, creatorName });
      router.replace('/', { shallow: true });
    }
  }, [searchParams, openRatingModal, router]);

  return null;
}

export default function Home() {
  const { signIn, signOut } = useAuth();
  const { updateUserProfile } = useUserProfile();
  const { requestCoinCharge } = useCoin();

  const {
    user, isAuthLoading, userCoins, userGender, // ✨ [추가] userGender
    isProfileModalOpen, openProfileModal, closeProfileModal,
    isCoinModalOpen, openCoinModal, closeCoinModal,
  } = useAppStore();

  // ✨ [추가] 매칭 유저 로드
  const { matchingUsers, isLoading: isMatchingLoading } = useMatchingUsers(userGender);

  if (isAuthLoading) {
    return <div className={styles.main}><div>Loading...</div></div>;
  }

  // ✨ [수정] 로그인 상태일 때 매칭 UI 렌더링
  if (user) {
    const needsGenderSetup = !userGender; // 성별 미설정 여부

    return (
      <>
        <Suspense fallback={<div>Loading...</div>}>
          <RatingTrigger />
        </Suspense>

        <Header 
          user={user} 
          userCoins={userCoins}
          onAvatarClick={openProfileModal}
          onCoinClick={openCoinModal}
        />
        <main className={styles.main}>
          <div className={styles.loginContainer}>
            <h1 className={styles.loginTitle}>커플 매칭</h1>
            <p className={styles.loginDescription}>
              {needsGenderSetup 
                ? "성별을 설정하고 이상형을 찾아보세요!" 
                : "관심사가 비슷한 상대를 찾아보세요."
              }
            </p>
          </div>

          <div className={styles.matchingContainer}>
            {needsGenderSetup && (
              <div className={styles.genderCtaOverlay}>
                <p>만남을 신청하고<br/>추천 상대를 확인해보세요!</p>
                <a
                  className={styles.ctaButton}
                  href="/apply"
                >
                  만남 신청하기
                </a>
              </div>
            )}

            <div className={needsGenderSetup ? styles.blurContainer : ''}>
              {isMatchingLoading ? (
                <div className={styles.swiperContainer} style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <p>사용자 찾는 중...</p>
                </div>
              ) : (
                <Swiper
                  modules={[Pagination, Autoplay]}
                  pagination={{ clickable: true }}
                  loop={true}
                  autoplay={{
                    delay: 2500,
                    disableOnInteraction: false,
                  }}
                  className={styles.swiperContainer}
                >
                  {matchingUsers.map(matchUser => (
                    <SwiperSlide key={matchUser.uid} className={styles.swiperSlide}>
                      <Image
                        src={matchUser.photoURL || '/images/icon.png'}
                        alt={matchUser.displayName || 'User'}
                        fill
                        sizes="(max-width: 600px) 100vw, 400px"
                        className={styles.swiperImage}
                        // ✨ [제거] priority 속성 제거
                      />
                    </SwiperSlide>
                  ))}
                </Swiper>
              )}
            </div>
          </div>
          
          <button 
            className={styles.createButton} 
            style={{ width: '100%', maxWidth: '400px', marginTop: '2rem' }} 
            disabled
          >
            매칭 시작 (준비 중)
          </button>
        </main>

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
      </>
    );
  }

  // 로그아웃 상태일 때 로그인 UI
  return (
    <main className={styles.main}>
      <div className={styles.loginContainer}>
          <h1 className={styles.loginTitle}>취향만남</h1>
          <p className={styles.loginDescription}>관심사 기반 영상 채팅을 시작해보세요.</p>
          <button onClick={signIn} className={styles.loginButton}>
              Google 계정으로 시작하기
          </button>
      </div>
    </main>
  );
}

