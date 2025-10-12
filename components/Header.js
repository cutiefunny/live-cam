// components/Header.js
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/app/Home.module.css';

const Header = ({ user, userCoins, onAvatarClick, onCoinClick }) => {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <h1 className={styles.logo}>취향캠톡</h1>
        {user && (
          <div className={styles.userInfoHeader}>
            <Link href="/chat" className={styles.chatIcon}>
              💬
            </Link>
            <span className={styles.coinInfo} onClick={onCoinClick}> {userCoins} Coins</span>
            <button onClick={onAvatarClick} className={styles.avatarButton}>
              <Image 
                src={user.photoURL} 
                alt={user.displayName} 
                width={40} 
                height={40}
                className={styles.userAvatar} 
                priority={true}
              />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;