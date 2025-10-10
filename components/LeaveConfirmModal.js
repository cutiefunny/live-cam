// components/LeaveConfirmModal.js
import React from 'react';
import { formatDuration } from '@/lib/utils';
import styles from './LeaveConfirmModal.module.css';

const LeaveConfirmModal = ({ show, onConfirm, onCancel, details, isCreator, settings }) => {
  if (!show || !details) {
    return null;
  }

  const { duration } = details;
  const minutes = Math.floor(duration / 60000);
  let coins = 0;
  let fee = 0;

  if (settings) {
    const { costToStart, costPerMinute, creatorShareRate } = settings;
    if (isCreator) {
        const earnings = (costToStart || 0) + (minutes * (costPerMinute || 0));
        fee = Math.floor(earnings * (1 - ((creatorShareRate || 100) / 100)));
        coins = earnings - fee;
    } else {
        coins = (costToStart || 0) + (minutes * (costPerMinute || 0));
    }
  }


  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>통화 종료</h2>
        <p>정말로 통화를 종료하시겠습니까?</p>
        <div className={styles.callDetails}>
          <div className={styles.detailItem}>
            <span>통화 시간</span>
            <span>{formatDuration(duration)}</span>
          </div>
          {isCreator ? (
            <>
              <div className={styles.detailItem}>
                <span>예상 획득 코인</span>
                <span className={styles.coinsEarned}>💰 +{coins}</span>
              </div>
              <div className={styles.detailItem}>
                <span>수수료</span>
                <span>💰 -{fee}</span>
              </div>
            </>
          ) : (
            <div className={styles.detailItem}>
              <span>사용 코인</span>
              <span className={styles.coinsUsed}>💰 -{coins}</span>
            </div>
          )}
        </div>
        <div className={styles.modalActions}>
          <button onClick={onCancel} className={styles.cancelButton}>취소</button>
          <button onClick={onConfirm} className={styles.confirmButton}>종료</button>
        </div>
      </div>
    </div>
  );
};

export default LeaveConfirmModal;