// components/Video.js
import { useEffect, useRef } from 'react';

const Video = ({ peer, photoURL }) => {
  const ref = useRef();

  useEffect(() => {
    // ✅ 스트림을 처리할 핸들러 함수를 정의합니다.
    const handleStream = (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    };

    if (peer) {
      // 이벤트 리스너를 등록합니다.
      peer.on('stream', handleStream);
    }

    // ✅ 클린업 함수: 컴포넌트가 사라지거나 peer 객체가 바뀔 때 리스너를 제거합니다.
    return () => {
      if (peer) {
        peer.off('stream', handleStream);
      }
    };
  }, [peer]);

  return (
    <div style={{ position: 'relative', width: "300px", margin: "10px", backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
        <video playsInline autoPlay ref={ref} style={{ width: "100%", display: 'block' }} />
        {photoURL && (
            <img
            src={photoURL}
            alt="Profile"
            style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid white',
                boxShadow: '0 0 5px rgba(0,0,0,0.5)'
            }}
            />
        )}
    </div>
  );
};

export default Video;
