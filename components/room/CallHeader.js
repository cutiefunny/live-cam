// components/room/CallHeader.js
'use client';
import CallQualityIndicator from '@/components/CallQualityIndicator';
import styles from '@/app/room/[roomId]/Room.module.css';

export default function CallHeader({ roomId, quality, onLeave, hasRemoteStream }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.roomInfo}>
        Room: <span className={styles.roomId}>{roomId}</span>
      </h1>
      {hasRemoteStream && <CallQualityIndicator quality={quality} />}
      <button onClick={onLeave} className={styles.exitButton}>
        Leave Room
      </button>
    </header>
  );
}