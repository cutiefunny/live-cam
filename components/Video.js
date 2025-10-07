// components/Video.js
import { useEffect, useRef } from 'react';
import styles from './Video.module.css';

const Video = ({ peer, photoURL, displayName }) => {
  const ref = useRef();
  // MediaStream 객체를 안정적으로 참조하기 위해 ref를 사용합니다.
  const streamRef = useRef(new MediaStream());

  useEffect(() => {
    if (!peer) return;

    // 'track' 이벤트 핸들러: 상대방으로부터 비디오/오디오 트랙을 수신할 때마다 호출됩니다.
    const handleTrack = (track, stream) => {
      console.log('[Video.js] Received remote track:', track);
      // 기존에 같은 종류(video/audio)의 트랙이 있다면 제거하고 새로 추가합니다.
      const existingTracks = streamRef.current.getTracks();
      existingTracks.forEach(t => {
        if (t.kind === track.kind) {
          streamRef.current.removeTrack(t);
        }
      });
      
      streamRef.current.addTrack(track);

      if (ref.current) {
        // 비디오 요소에 스트림을 연결합니다.
        ref.current.srcObject = streamRef.current;
        ref.current.play().catch(error => {
            console.error('Error attempting to play remote video:', error);
        });
      }
    };

    peer.on('track', handleTrack);

    // 컴포넌트가 언마운트되거나 peer가 변경될 때 실행되는 정리 함수
    return () => {
      peer.off('track', handleTrack);
      // 스트림과 트랙을 정리하여 메모리 누수를 방지합니다.
      if (ref.current && ref.current.srcObject) {
        ref.current.srcObject = null;
      }
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = new MediaStream();
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