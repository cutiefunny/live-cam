// lib/utils.js

/**
 * 밀리초를 'Xm XXs' 형식의 문자열로 변환합니다.
 * @param {number} ms - 변환할 밀리초
 * @returns {string} 포맷된 시간 문자열
 */
export const formatDuration = (ms) => {
  if (!ms || ms < 1000) return '< 1s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

/**
 * 카메라/마이크 권한이 없을 때 사용할 빈 MediaStream을 생성합니다.
 * @returns {MediaStream} 비디오와 오디오 트랙이 비활성화된 스트림
 */
export const createDummyStream = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
      ctx.fillRect(0, 0, 1, 1);
  }
  const stream = canvas.captureStream();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const dst = oscillator.connect(audioContext.createMediaStreamDestination());
  oscillator.start();
  const audioTrack = dst.stream.getAudioTracks()[0];
  stream.addTrack(audioTrack);
  
  stream.getTracks().forEach(track => track.enabled = false);
  return stream;
};