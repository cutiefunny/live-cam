// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ peer, photoURL, displayName }) => {
  const ref = useRef();

  useEffect(() => {
    if (!peer) return;

    // 'stream' 이벤트 핸들러: 상대방의 MediaStream 객체를 직접 수신합니다.
    const handleStream = (stream) => {
      console.log('[Video.js] Received remote stream object.');
      if (ref.current) {
        ref.current.srcObject = stream;
        ref.current.play().catch(error => {
            console.error('Error attempting to play remote video:', error);
        });
      }
    };

    peer.on('stream', handleStream);

    // 컴포넌트 언마운트 시 정리 함수
    return () => {
      peer.off('stream', handleStream);
      if (ref.current && ref.current.srcObject) {
        const stream = ref.current.srcObject;
        if (stream) {
          // 스트림의 모든 트랙을 중지합니다.
          stream.getTracks().forEach(track => track.stop());
        }
        ref.current.srcObject = null;
      }
    };
  }, [peer]);

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