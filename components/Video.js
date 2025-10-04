// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ peer, photoURL, displayName }) => {
  const ref = useRef();

  useEffect(() => {
    const handleStream = (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    };

    if (peer) {
      peer.on('stream', handleStream);
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