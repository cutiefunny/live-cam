// components/room/CallFooter.js
'use client';
import Controls from '@/components/Controls';
import styles from '@/app/room/[roomId]/Room.module.css';

export default function CallFooter({ stream, isCreator, hasOtherUser, onGiftClick }) {
  if (!stream) {
    return null;
  }
  
  return (
    <footer className={styles.footer}>
      <Controls stream={stream} />
      {!isCreator && hasOtherUser && (
        <button onClick={onGiftClick} className={styles.giftButton}>
          🎁
        </button>
      )}
    </footer>
  );
}