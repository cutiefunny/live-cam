// app/page.js
'use client';
import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth'; // ✨ [수정] 주석 해제
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCoin } from '@/hooks/useCoin';
import useAppStore from '@/store/useAppStore';
import styles from './Home.module.css';
import Header from '@/components/Header';
import ProfileModal from '@/components/ProfileModal';
import CoinModal from '@/components/CoinModal';
import RatingModal from '@/components/RatingModal';
// Swiper 임포트
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/autoplay';
// 신규 훅 임포트
import { useMatchingUsers } from '@/hooks/useMatchingUsers';
import Image from 'next/image'; // Image 컴포넌트

// RatingTrigger 위치 page.js 내부로 이동
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
  const { signIn, signOut } = useAuth(); // ✨ 이 줄에서 useAuth()가 필요합니다.
  const { updateUserProfile } = useUserProfile();
  const { requestCoinCharge } = useCoin();
  const router = useRouter(); 

  const {
    user, isAuthLoading, userCoins, userGender, applicationStatus, isCreator,
    isProfileModalOpen, openProfileModal, closeProfileModal,
    isCoinModalOpen, openCoinModal, closeCoinModal,
  } = useAppStore();

  const { matchingUsers, isLoading: isMatchingLoading } = useMatchingUsers(userGender);
  
  const [fortune, setFortune] = useState('오늘의 연애운을 불러오는 중...');

  // 크리에이터 리디렉션 useEffect
  useEffect(() => {
    // 로딩이 끝났고, 유저가 존재하며, 크리에이터일 경우
    if (!isAuthLoading && user && isCreator) {
      router.replace('/creator');
    }
  }, [isAuthLoading, user, isCreator, router]);

  useEffect(() => {
    if (user) {
      const fetchFortune = async () => {
        try {
          const response = await fetch('https://musclecat.co.kr/getOneFortune', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ agenda: '연애' }),
          });
          if (!response.ok) {
            throw new Error('API request failed');
          }
          const data = await response.json();
          if (data && data.fortune) {
            setFortune(data.fortune);
          } else {
            setFortune('연애운 정보를 가져올 수 없습니다.');
          }
        } catch (error) {
          console.error('Failed to fetch fortune:', error);
          setFortune('연애운을 불러오는데 실패했습니다.');
        }
      };
      
      fetchFortune();
    }
  }, [user]);

  const formattedFortune = useMemo(() => {
    // 로딩 또는 에러 메시지는 가공하지 않음
    if (fortune.includes('...') || fortune.includes('실패') || fortune.includes('없습니다')) {
      return fortune;
    }

    const middleIndex = Math.floor(fortune.length / 2);
    
    // 중간 지점에서 가장 가까운 띄어쓰기(공백)를 찾습니다.
    let breakIndex = fortune.indexOf(' ', middleIndex);
    
    // 중간 지점 뒤에 공백이 없으면, 중간 지점 앞에서 찾습니다.
    if (breakIndex === -1) {
      breakIndex = fortune.lastIndexOf(' ', middleIndex);
    }
    
    // 띄어쓰기를 찾은 경우
    if (breakIndex !== -1) {
      // 띄어쓰기 부분을 \n(줄바꿈) 문자로 변경합니다.
      return fortune.substring(0, breakIndex) + '\n' + fortune.substring(breakIndex + 1);
    } else {
      // 띄어쓰기가 없는 매우 긴 단어인 경우, 그냥 중간을 자릅니다.
      return fortune.substring(0, middleIndex) + '\n' + fortune.substring(middleIndex);
    }
  }, [fortune]);

  // 로딩 중이거나, 크리에이터라서 리디렉션 대기 중일 때 로딩 표시
  if (isAuthLoading || (user && isCreator)) {
    return <div className={styles.main}><div>Loading...</div></div>;
  }

  // 로그인 상태일 때 (크리에이터가 아닌) 매칭 UI 렌더링
  if (user) {
    const needsApproval = applicationStatus !== 'approved';

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

          <div className={styles.fortuneContainer}>
            <h3 className={styles.fortuneTitle}>💖 오늘의 연애운</h3>
            <p className={styles.fortuneContent}>{formattedFortune}</p>
          </div>
          
          <div className={styles.matchingContainer}>
            {needsApproval && (
              <div className={styles.genderCtaOverlay}>
                <p>만남을 신청하고<br/>추천 상대를 확인해보세요!</p>
                <a
                  className={styles.ctaButton}
                  href="/apply"
                >
                  {applicationStatus === 'submitted' ? '승인 대기 중' : '만남 신청하기'}
                </a>
              </div>
            )}

            <div className={needsApproval ? styles.blurContainer : ''}>
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
            disabled={needsApproval} // 'approved' 상태가 아니면 disabled
            onClick={() => router.push('/creator')} // 클릭 시 /creator로 이동
          >
            {needsApproval ? '매칭 시작 (준비 중)' : '매칭 시작'}
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