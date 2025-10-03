// components/Video.js
import { useEffect, useRef } from 'react';

const Video = ({ peer }) => {
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

  // ✅ 상대방 비디오는 소리가 들려야 하므로 muted 속성은 제거하는 것이 맞습니다.
  // 다만 자동재생 정책으로 인해 소리가 안나올 수 있습니다.
  return <video playsInline autoPlay ref={ref} style={{ width: "300px", margin: "10px" }} />;
};

export default Video;