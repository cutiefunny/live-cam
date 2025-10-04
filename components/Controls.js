// components/Controls.js
import { useState } from 'react';
import styles from './Controls.module.css';

// SVG 아이콘 컴포넌트는 변경 없이 그대로 사용합니다.
// ... (SVG Icon components 생략) ...
const VideoOnIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg> );
const VideoOffIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> );
const MicOnIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg> );
const MicOffIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg> );
const ScreenShareIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 17a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2z"></path><path d="M10 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"></path><path d="m15 9-4-4 4-4"></path><path d="M11 5h4"></path></svg> );


const Controls = ({ stream }) => {
  const [isVideoOn, setIsVideoOn] = useState(() => stream.getVideoTracks()[0]?.enabled ?? false);
  const [isAudioOn, setIsAudioOn] = useState(() => stream.getAudioTracks()[0]?.enabled ?? false);

  const handleToggleVideo = () => {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  const handleToggleAudio = () => {
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  return (
    <div className={styles.container}>
      <button onClick={handleToggleAudio} className={`${styles.button} ${isAudioOn ? styles.on : styles.off}`}>
        {isAudioOn ? <MicOnIcon /> : <MicOffIcon />}
      </button>
      <button onClick={handleToggleVideo} className={`${styles.button} ${isVideoOn ? styles.on : styles.off}`}>
        {isVideoOn ? <VideoOnIcon /> : <VideoOffIcon />}
      </button>
      <button disabled className={`${styles.button} ${styles.on}`}>
        <ScreenShareIcon />
      </button>
    </div>
  );
};

export default Controls;