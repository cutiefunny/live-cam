// components/creator/PhotoUploadModal.js
'use client';
import { useState, useRef } from 'react';
import useAppStore from '@/store/useAppStore';
import styles from '@/app/creator/[creatorId]/CreatorProfile.module.css';
import { nanoid } from 'nanoid';

export default function PhotoUploadModal({ onClose, onUpload }) {
  const [photoItems, setPhotoItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const showToast = useAppStore((state) => state.showToast);

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length + photoItems.length > 5) {
      showToast('한 번에 최대 5개의 사진만 업로드할 수 있습니다.', 'error');
      return;
    }

    const newItems = selectedFiles.map((file) => ({
      id: nanoid(),
      file: file,
      preview: URL.createObjectURL(file),
    }));

    setPhotoItems((prev) => [...prev, ...newItems]);
  };

  const handleRemovePhoto = (id) => {
    setPhotoItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragStart = (e, index) => {
    dragItem.current = index;
    e.currentTarget.classList.add(styles.dragging);
  };

  const handleDragEnter = (e, index) => {
    dragOverItem.current = index;
  };
  
  const handleDrop = () => {
    const newPhotoItems = [...photoItems];
    const draggedItemContent = newPhotoItems.splice(dragItem.current, 1)[0];
    newPhotoItems.splice(dragOverItem.current, 0, draggedItemContent);
    
    dragItem.current = null;
    dragOverItem.current = null;
    
    setPhotoItems(newPhotoItems);
  };
  
  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.dragging);
    handleDrop();
  };

  const handleUpload = async () => {
    if (photoItems.length === 0) {
      showToast('업로드할 사진을 선택하세요.', 'error');
      return;
    }
    setIsUploading(true);
    try {
      const filesToUpload = photoItems.map(item => item.file);
      await onUpload(filesToUpload);
      showToast('사진이 성공적으로 업로드되었습니다.', 'success');
      onClose();
    } catch (error) {
      showToast('사진 업로드에 실패했습니다.', 'error');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>사진 업로드</h2>
        <div className={styles.uploadDropzone} onClick={() => fileInputRef.current.click()}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/gif"
            multiple
            style={{ display: 'none' }}
          />
          <p>클릭하여 사진 선택 (최대 5개)</p>
        </div>
        {photoItems.length > 0 && (
          <div className={styles.previewGrid}>
            {photoItems.map((item, index) => (
              <div
                key={item.id}
                className={styles.previewContainer}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
              >
                <button onClick={() => handleRemovePhoto(item.id)} className={styles.deletePreviewButton}>
                  &times;
                </button>
                <img src={item.preview} alt="Preview" className={styles.previewImage} />
              </div>
            ))}
          </div>
        )}
        <div className={styles.modalActions}>
          <button onClick={onClose} className={styles.cancelButton}>취소</button>
          <button onClick={handleUpload} disabled={isUploading} className={styles.saveButton}>
            {isUploading ? '업로드 중...' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}