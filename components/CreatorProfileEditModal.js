// components/CreatorProfileEditModal.js
'use client';
import { useState } from 'react';
import styles from '@/app/creator/[creatorId]/CreatorProfile.module.css';

// ✨ [수정] props 변경: currentBio -> bio, onBioChange 추가
export default function CreatorProfileEditModal({ bio, onBioChange, onClose, onSave }) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(); // ✨ [수정] 더 이상 bio를 인자로 전달하지 않음
    setIsSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>프로필 수정</h2>
        <textarea
          className={styles.bioTextarea}
          value={bio} // ✨ [수정] 부모로부터 받은 bio state를 사용
          onChange={(e) => onBioChange(e.target.value)} // ✨ [수정] 부모의 state를 변경하는 함수 호출
          placeholder="자신을 소개해보세요."
          rows={5}
        />
        <div className={styles.modalActions}>
          <button onClick={onClose} className={styles.cancelButton}>취소</button>
          <button onClick={handleSave} disabled={isSaving} className={styles.saveButton}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}