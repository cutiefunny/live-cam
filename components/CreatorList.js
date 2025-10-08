// components/CreatorList.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import styles from './CreatorList.module.css';

const CreatorList = ({ rankedCreators, user, onCallCreator }) => {
  const [showAllCreators, setShowAllCreators] = useState(false);

  const creatorsToShow = rankedCreators.filter(creator => creator && creator.uid);

  return (
    <>
      <h2 className={styles.creatorListTitle}>🏆 크리에이터 순위</h2>
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
          : (<p>등록된 크리에이터가 없습니다.</p>)
        }
      </div>
      {!showAllCreators && creatorsToShow.length > 3 && (
        <button onClick={() => setShowAllCreators(true)} className={styles.showAllButton}>
          모든 크리에이터 보기
        </button>
      )}
    </>
  );
};

export default CreatorList;