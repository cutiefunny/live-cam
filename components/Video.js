// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ peer, photoURL, displayName }) => {
  const ref = useRef();
  // MediaStream 객체를 안정적으로 참조하기 위해 ref를 사용합니다.
  const streamRef = useRef(null);

  useEffect(() => {
    if (!peer) return;

    // 스트림이 아직 없으면 새로 생성하고 비디오 요소에 연결합니다.
    if (!streamRef.current) {
      streamRef.current = new MediaStream();
    }
    
    if (ref.current && !ref.current.srcObject) {
      ref.current.srcObject = streamRef.current;
    }

    // 'track' 이벤트 핸들러: 상대방으로부터 비디오/오디오 트랙을 수신할 때마다 호출됩니다.
    const handleTrack = (track, stream) => {
      console.log('[Video.js] Received remote track:', track.kind);
      
      // 스트림에 이미 해당 종류의 트랙이 있는지 확인하고, 있다면 교체합니다.
      const existingTracks = streamRef.current.getTracks().filter(t => t.kind === track.kind);
      existingTracks.forEach(t => streamRef.current.removeTrack(t));

      // 새 트랙을 스트림에 추가합니다.
      streamRef.current.addTrack(track);

      // 비디오가 멈춰있으면 다시 재생을 시도합니다.
      if (ref.current.paused) {
        ref.current.play().catch(error => {
            console.error('Error attempting to play remote video:', error);
        });
      }
    };

    peer.on('track', handleTrack);

    // 컴포넌트가 언마운트되거나 peer가 변경될 때 실행되는 정리 함수
    return () => {
      peer.off('track', handleTrack);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (ref.current && ref.current.srcObject) {
        ref.current.srcObject = null;
      }
      streamRef.current = null;
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