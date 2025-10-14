// components/room/GiftAnimation.js
'use client';
import { useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import styles from '@/app/room/[roomId]/Room.module.css';

export default function GiftAnimation() {
  const { giftAnimation, setGiftAnimation } = useAppStore();

  useEffect(() => {
    if (giftAnimation) {
      const timer = setTimeout(() => {
        setGiftAnimation(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [giftAnimation, setGiftAnimation]);

  if (!giftAnimation) return null;

  return (
    <div className={styles.giftAnimationOverlay}>
      <div className={styles.giftAnimationContent}>
        <div className={styles.giftIcon}>{giftAnimation.icon}</div>
        <p>{giftAnimation.senderName}님이 {giftAnimation.name} 선물을 보냈습니다!</p>
      </div>
    </div>
  );
};