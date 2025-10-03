// components/Video.js
import { useEffect, useRef } from 'react';

const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    if (peer) {
      peer.on('stream', stream => {
        if (ref.current) {
          ref.current.srcObject = stream;
        }
      });
    }
  }, [peer]);

  return <video playsInline autoPlay ref={ref} style={{ width: "300px", margin: "10px" }} />;
};

export default Video;