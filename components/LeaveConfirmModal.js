// components/LeaveConfirmModal.js
import React from 'react';
import { formatDuration } from '@/lib/utils';
import styles from './LeaveConfirmModal.module.css';

const LeaveConfirmModal = ({ show, onConfirm, onCancel, details }) => {
  if (!show) {
    return null;
  }

  const { duration, coins, fee, isCreator } = details;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
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