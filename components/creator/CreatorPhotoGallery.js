// components/creator/CreatorPhotoGallery.js
'use client';
import { useState, useEffect, useRef } from 'react';
import styles from '@/app/creator/[creatorId]/CreatorProfile.module.css';

const ImageModal = ({ src, onClose }) => (
  <div className={styles.photoModalOverlay} onClick={onClose}>
    <img src={src} alt="Selected" className={styles.photoModalContent} />
  </div>
);

export default function CreatorPhotoGallery({ photos: initialPhotos, isOwner, onAddPhoto, onDeletePhoto, onOrderSave }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);
  
  const handleDragStart = (e, index) => {
    dragItem.current = index;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e, index) => {
    if (dragItem.current === index) return;
    dragOverItem.current = index;
    const newPhotos = [...photos];
    const draggedItemContent = newPhotos.splice(dragItem.current, 1)[0];
    newPhotos.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = dragOverItem.current;
    dragOverItem.current = null;
    setPhotos(newPhotos);
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    dragItem.current = null;
    dragOverItem.current = null;
  };
  
  const handleSaveOrder = () => {
    onOrderSave(photos);
  };

  return (
    <div className={styles.photoSection}>
      <div className={styles.photoHeader}>
        <h2 className={styles.sectionTitle}>사진첩</h2>
        {isOwner && (
          <div className={styles.photoActions}>
            <button onClick={handleSaveOrder} className={styles.saveOrderButton}>순서 저장</button>
            {/* ✨ [수정] onClick 핸들러가 이 버튼에만 있는지 확인합니다. */}
            <button onClick={onAddPhoto} className={styles.addPhotoButton}>+ 사진 추가</button>
          </div>
        )}
      </div>
      <div className={styles.photoGrid}>
        {photos && photos.length > 0 ? (
          photos.map((photo, index) => (
            <div 
              key={photo.id} 
              className={`${styles.photoContainer} ${isDragging ? styles.dragging : ''}`}
              draggable={isOwner}
              onDragStart={isOwner ? (e) => handleDragStart(e, index) : null}
              onDragEnter={isOwner ? (e) => handleDragEnter(e, index) : null}
              onDragEnd={isOwner ? handleDragEnd : null}
              onDragOver={(e) => e.preventDefault()}
            >
              <img
                src={photo.url}
                alt="Creator content"
                className={styles.photo}
                onClick={() => !isDragging && setSelectedImage(photo.url)}
              />
              {isOwner && (
                <button
                  onClick={() => onDeletePhoto(photo.id)}
                  className={styles.deletePhotoButton}
                >
                  &times;
                </button>
              )}
            </div>
          ))
        ) : (
          <p className={styles.noPhotos}>등록된 사진이 없습니다.</p>
        )}
      </div>
      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}