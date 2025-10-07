// components/GiftModal.js
'use client';
import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import styles from './GiftModal.module.css';

const gifts = [
  { name: 'Heart', cost: 10, icon: '💖' },
  { name: 'Star', cost: 20, icon: '⭐' },
  { name: 'Rocket', cost: 50, icon: '🚀' },
  { name: 'Diamond', cost: 100, icon: '💎' },
];

export default function GiftModal({ onClose, onSendGift }) {
  const [isSending, setIsSending] = useState(false);
  const { userCoins, showToast } = useAppStore();

  const handleSendClick = async (gift) => {
    if (userCoins < gift.cost) {
      showToast('코인이 부족합니다.', 'error');
      return;
    }
    setIsSending(true);
    try {
      await onSendGift(gift);
      showToast(`${gift.name} 선물을 보냈습니다!`, 'success');
      onClose();
    } catch (error) {
      showToast('선물 보내기에 실패했습니다.', 'error');
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>선물하기</h2>
        <div className={styles.giftGrid}>
          {gifts.map((gift) => (
            <button
              key={gift.name}
              className={styles.giftItem}
              onClick={() => handleSendClick(gift)}
              disabled={isSending || userCoins < gift.cost}
            >
              <div className={styles.giftIcon}>{gift.icon}</div>
              <div className={styles.giftName}>{gift.name}</div>
              <div className={styles.giftCost}>💰 {gift.cost}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}