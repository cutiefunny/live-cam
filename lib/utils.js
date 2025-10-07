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