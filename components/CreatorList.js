// components/CreatorList.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import styles from './CreatorList.module.css';

const CreatorList = ({ rankedCreators, user, onCallCreator }) => {
  const [showAllCreators, setShowAllCreators] = useState(false);

  // 팔로우 목록과 중복되지 않도록 rankedCreators는 이미 필터링된 상태로 가정합니다.
  const creatorsToShow = rankedCreators.filter(creator => creator && creator.uid);

  return (
    // ✨ [수정] 전체를 감싸는 컨테이너와 제목 추가
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
                        <img src={creator.photoURL || '/images/icon.png'} alt={creator.displayName} className={styles.creatorAvatar} />
                        {creator.isOnline && <div className={styles.onlineIndicator}></div>}
                    </div>
                    {creator.displayName}
                  </Link>
                </div>
                {creator.uid !== user.uid && (
                  <button 
                    onClick={() => onCallCreator(creator)} 
                    className={styles.callButton}
                    disabled={!creator.isOnline}
                  >
                    Call
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