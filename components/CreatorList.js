// components/CreatorList.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // ✨ [추가]
import styles from './CreatorList.module.css';

const CreatorList = ({ rankedCreators, user, onCallCreator }) => {
  const [showAllCreators, setShowAllCreators] = useState(false);

  const creatorsToShow = rankedCreators.filter(creator => creator && creator.uid);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🏆 크리에이터 순위</h2>
      <div className={styles.creatorList}>
        {creatorsToShow.length > 0 ? 
          creatorsToShow
            .slice(0, showAllCreators ? creatorsToShow.length : 3)
            .map((creator, index) => (
              <div key={creator.uid} className={styles.creatorItem}>
                <div className={styles.creatorRankInfo}>
                  <Link href={`/creator/${creator.uid}`} className={styles.creatorNameLink}>
                    <span className={styles.creatorRank}>{index + 1}</span>
                    <div className={styles.creatorAvatarContainer}>
                        {/* ✨ [수정] img -> Image */}
                        <Image 
                            src={creator.photoURL || '/images/icon.png'} 
                            alt={creator.displayName || 'No Name'} 
                            width={32}
                            height={32}
                            className={styles.creatorAvatar} 
                        />
                        {creator.isOnline && <div className={styles.onlineIndicator}></div>}
                    </div>
                    {creator.displayName || '이름 없음'}
                  </Link>
                </div>
                {creator.uid !== user.uid && (
                  <button 
                    onClick={() => onCallCreator(creator)} 
                    className={styles.callButton}
                    disabled={!creator.isOnline}
                    title="통화하기" // ✨ [추가] 툴팁 추가
                  >
                    <Image // ✨ [수정] 텍스트 대신 Image 컴포넌트 사용
                      src="/images/call-icon.png"
                      alt="통화 아이콘"
                      width={24}
                      height={24}
                    />
                  </button>
                )}
              </div>
            )) 
          : (<p className={styles.emptyListText}>표시할 다른 크리에이터가 없습니다.</p>)
        }
      </div>
      {!showAllCreators && creatorsToShow.length > 3 && (
        <button onClick={() => setShowAllCreators(true)} className={styles.showAllButton}>
          모든 크리에이터 보기
        </button>
      )}
    </div>
  );
};

export default CreatorList;