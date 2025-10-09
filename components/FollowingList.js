// components/FollowingList.js
'use client';
import Link from 'next/link';
import styles from './FollowingList.module.css';

const FollowingList = ({ followingCreators, user, onCallCreator }) => {
  if (!followingCreators || followingCreators.length === 0) {
    return null; // 팔로우하는 크리에이터가 없으면 아무것도 렌더링하지 않음
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>❤️ 팔로우 중인 크리에이터</h2>
      <div className={styles.list}>
        {followingCreators.map((creator) => (
          <div key={creator.uid} className={styles.item}>
            <Link href={`/creator/${creator.uid}`} className={styles.profileLink}>
              <div className={styles.avatarContainer}>
                <img src={creator.photoURL || '/images/icon.png'} alt={creator.displayName} className={styles.avatar} />
                {creator.isOnline && <div className={styles.onlineIndicator}></div>}
              </div>
              <span className={styles.displayName}>{creator.displayName}</span>
            </Link>
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
        ))}
      </div>
    </div>
  );
};

export default FollowingList;