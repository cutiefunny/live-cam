// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ stream, photoURL, displayName }) => {
  const ref = useRef();

  useEffect(() => {
    if (stream && ref.current) {
      // stream prop이 존재하면 video 요소의 srcObject로 설정합니다.
      ref.current.srcObject = stream;
      ref.current.play().catch(error => {
        console.error('Error attempting to play remote video:', error);
      });
    }

    // 컴포넌트가 언마운트되거나 stream이 null이 될 때 비디오 소스를 정리합니다.
    return () => {
      if (ref.current && ref.current.srcObject) {
        ref.current.srcObject = null;
      }
    };
  }, [stream]); // stream이 변경될 때마다 이 effect가 실행됩니다.

  return (
    <div className={styles.container}>
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