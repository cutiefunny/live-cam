// components/Header.js
import React from 'react';
import styles from '@/app/Home.module.css';

const Header = ({ user, userCoins, onAvatarClick }) => {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <h1 className={styles.logo}>취향캠톡</h1>
        {user && (
          <div className={styles.userInfoHeader}>
            <span className={styles.coinInfo}>💰 {userCoins} Coins</span>
            <button onClick={onAvatarClick} className={styles.avatarButton}>
              <img src={user.photoURL} alt={user.displayName} className={styles.userAvatar} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
