// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ stream, photoURL, displayName, muted = false }) => {
  const ref = useRef();

  useEffect(() => {
    if (stream && ref.current) {
      // ✨ [수정] 스트림이 다른 경우에만 srcObject를 업데이트합니다.
      if (ref.current.srcObject !== stream) {
        ref.current.srcObject = stream;
      }
      // ✨ [수정] AbortError는 무시하여 콘솔 에러를 방지합니다.
      ref.current.play().catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Error attempting to play video:', error);
        }
      });
    }
  }, [stream]);

  // ✨ [추가] muted 속성을 별도의 useEffect로 관리합니다.
  useEffect(() => {
    if (ref.current) {
      ref.current.muted = muted;
    }
  }, [muted]);

  return (
    <div className={styles.container}>
      {/* video 태그에 muted 속성을 직접 사용하지 않고, useEffect로 제어합니다. */}
      <video playsInline autoPlay ref={ref} className={styles.video} />
      {photoURL && (
        <img
          src={photoURL}
          alt="Profile"
          className={styles.profileImage}
        />
      )}
      {displayName && (
        <div className={styles.displayName}>
          {displayName}
        </div>
      )}
    </div>
  );
};

export default Video;