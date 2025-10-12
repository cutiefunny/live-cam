// components/FollowingList.js
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './FollowingList.module.css';

const FollowingList = ({ followingCreators, user, onCallCreator }) => {
  const router = useRouter();

  if (!followingCreators || followingCreators.length === 0) {
    return null;
  }

  const handleChatCreator = (creator) => {
    router.push(`/chat/${creator.uid}`);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>❤️ 팔로우 중인 크리에이터</h2>
      <div className={styles.list}>
        {followingCreators.map((creator) => (
          <div key={creator.uid} className={styles.item}>
            <Link href={`/creator/${creator.uid}`} className={styles.profileLink}>
              <div className={styles.avatarContainer}>
                <Image 
                    src={creator.photoURL || '/images/icon.png'} 
                    alt={creator.displayName} 
                    width={36}
                    height={36}
                    className={styles.avatar} 
                />
                {creator.isOnline && <div className={styles.onlineIndicator}></div>}
              </div>
              <span className={styles.displayName}>{creator.displayName}</span>
            </Link>
            {creator.uid !== user.uid && (
              <div className={styles.buttonGroup}>
                <button 
                  onClick={() => handleChatCreator(creator)} 
                  className={styles.chatButton}
                >
                  Chat
                </button>
                <button 
                  onClick={() => onCallCreator(creator)} 
                  className={styles.callButton}
                  disabled={!creator.isOnline}
                >
                  Call
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FollowingList;