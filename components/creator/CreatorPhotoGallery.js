// components/creator/CreatorPhotoGallery.js
'use client';
import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules'; 
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import styles from '@/app/creator/[creatorId]/CreatorProfile.module.css';

const ImageModal = ({ src, onClose }) => (
  <div className={styles.photoModalOverlay} onClick={onClose}>
    <img src={src} alt="Selected" className={styles.photoModalContent} />
  </div>
);

export default function CreatorPhotoGallery({ photos, isOwner, onAddPhoto, onDeletePhoto }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [swiperInstance, setSwiperInstance] = useState(null);

  const handleDeleteCurrentImage = () => {
    if (photos && photos.length > 0 && swiperInstance) {
      const photoToDelete = photos[swiperInstance.realIndex];
      onDeletePhoto(photoToDelete.id);
    }
  };

  if (!photos || photos.length === 0) {
    return (
      <div className={styles.photoSection}>
        <div className={styles.photoHeader}>
          <h2 className={styles.sectionTitle}>사진첩</h2>
          {isOwner && (
            <div className={styles.photoActions}>
              <button onClick={onAddPhoto} className={styles.addPhotoButton}>+ 사진 추가</button>
            </div>
          )}
        </div>
        <div className={styles.noPhotosContainer}>
          <p className={styles.noPhotos}>등록된 사진이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.photoSection}>
      <div className={styles.photoHeader}>
        <h2 className={styles.sectionTitle}>사진첩</h2>
        {isOwner && (
          <div className={styles.photoActions}>
            <button onClick={onAddPhoto} className={styles.addPhotoButton}>+ 사진 추가</button>
          </div>
        )}
      </div>
      
      <div className={styles.albumContainer}>
        <Swiper
          effect={'coverflow'}
          grabCursor={true}
          centeredSlides={true}
          slidesPerView={'auto'}
          coverflowEffect={{
            rotate: 50,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: false,
          }}
          pagination={{
            el: `.${styles.paginationContainer}`,
            clickable: true,
            // ✨ [제거] renderBullet 함수를 제거합니다.
          }}
          modules={[EffectCoverflow, Pagination]}
          onSwiper={setSwiperInstance}
          className={styles.swiperContainer}
        >
          {photos.map((photo, index) => (
            <SwiperSlide key={photo.id} className={styles.albumSlide}>
              {({ isActive }) => (
                <img
                  src={photo.url}
                  alt={`Creator content ${index + 1}`}
                  className={styles.albumImage}
                  onClick={() => isActive && setSelectedImage(photo.url)}
                />
              )}
            </SwiperSlide>
          ))}
        </Swiper>
        
        <div className={styles.paginationContainer}></div>

        {isOwner && (
          <button
            onClick={handleDeleteCurrentImage}
            className={styles.deletePhotoButton}
          >
            &times;
          </button>
        )}
      </div>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}