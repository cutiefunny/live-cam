// components/CreatorList.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
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
                        <img src={creator.photoURL || '/images/icon.png'} alt={creator.displayName || 'No Name'} className={styles.creatorAvatar} />
                        {creator.isOnline && <div className={styles.onlineIndicator}></div>}
                    </div>
                    {/* ✨ [수정] displayName이 없을 경우 '이름 없음'을 표시합니다. */}
                    {creator.displayName || '이름 없음'}
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