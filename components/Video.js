// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ peer, photoURL, displayName }) => {
  const ref = useRef();

  useEffect(() => {
    const handleStream = (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
        ref.current.play().catch(error => {
            console.error('Error attempting to play remote video:', error);
        });
      }
    };

    if (peer) {
      // 'stream' 이벤트 리스너를 등록합니다.
      peer.on('stream', handleStream);
      
      // ✨ [수정] 컴포넌트가 렌더링되는 시점에 스트림이 이미 도착했는지 확인합니다.
      // 만약 'stream' 이벤트를 놓쳤더라도 여기서 스트림을 연결할 수 있습니다.
      if (peer.streams && peer.streams[0]) {
        handleStream(peer.streams[0]);
      }
    }

    return () => {
      if (peer) {
        peer.off('stream', handleStream);
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