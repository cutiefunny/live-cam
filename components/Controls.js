// components/Controls.js
import { useState } from 'react';

const Controls = ({ stream, onToggleVideo, onToggleAudio, onShareScreen }) => {
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const handleToggleVideo = () => {
    const videoTrack = stream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoOn(videoTrack.enabled);
    onToggleVideo(videoTrack.enabled);
  };

  const handleToggleAudio = () => {
    const audioTrack = stream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    setIsAudioOn(audioTrack.enabled);
    onToggleAudio(audioTrack.enabled);
  };

  const handleShareScreen = () => {
    onShareScreen(!isScreenSharing);
    setIsScreenSharing(!isScreenSharing);
  };

  return (
    <div>
      <button onClick={handleToggleVideo}>{isVideoOn ? '카메라 끄기' : '카메라 켜기'}</button>
      <button onClick={handleToggleAudio}>{isAudioOn ? '마이크 끄기' : '마이크 켜기'}</button>
      <button onClick={handleShareScreen}>{isScreenSharing ? '화면 공유 중지' : '화면 공유 시작'}</button>
    </div>
  );
};

export default Controls;