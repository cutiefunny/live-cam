// components/RatingModal.js
'use client';
import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import styles from './RatingModal.module.css';

const Star = ({ filled, onClick, onMouseEnter, onMouseLeave }) => (
  <span
    className={`${styles.star} ${filled ? styles.filled : ''}`}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    ★
  </span>
);

export default function RatingModal() {
  const { isRatingModalOpen, closeRatingModal, ratingModalData } = useAppStore();
  const { submitRating } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isRatingModalOpen || !ratingModalData) {
    return null;
  }

  const { creatorId, creatorName } = ratingModalData;

  const handleClose = () => {
    setRating(0);
    setComment('');
    closeRatingModal();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      useAppStore.getState().showToast('별점을 선택해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    await submitRating(creatorId, rating, comment);
    setIsSubmitting(false);
    handleClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>{creatorName}님과의 통화는 어떠셨나요?</h2>
        <div className={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((index) => (
            <Star
              key={index}
              filled={hoverRating >= index || rating >= index}
              onClick={() => setRating(index)}
              onMouseEnter={() => setHoverRating(index)}
              onMouseLeave={() => setHoverRating(0)}
            />
          ))}
        </div>
        <textarea
          className={styles.commentTextarea}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="소중한 후기를 남겨주세요. (선택)"
          rows={4}
        />
        <div className={styles.modalActions}>
          <button onClick={handleClose} className={styles.cancelButton}>
            나중에
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting} className={styles.submitButton}>
            {isSubmitting ? '제출 중...' : '후기 남기기'}
          </button>
        </div>
      </div>
    </div>
  );
}