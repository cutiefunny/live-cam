// hooks/useCallQuality.js
'use client';
import { useState, useEffect, useRef } from 'react';

// ✨ [추가] 품질 상태에 따른 비디오 인코딩 설정
const QUALITY_SETTINGS = {
  good: {
    maxBitrate: undefined, // 무제한
    scaleResolutionDownBy: 1.0,
  },
  average: {
    maxBitrate: 500000, // 500kbps
    scaleResolutionDownBy: 1.5,
  },
  poor: {
    maxBitrate: 200000, // 200kbps
    scaleResolutionDownBy: 2.0,
  },
};

export function useCallQuality(peer) {
  const [quality, setQuality] = useState('good'); // 'good', 'average', 'poor'
  const intervalRef = useRef(null);
  const lastQualityRef = useRef('good');

  // ✨ [추가] WebRTC 송신자(sender)를 관리하기 위한 ref
  const videoSenderRef = useRef(null);

  useEffect(() => {
    if (!peer || peer.destroyed) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    // ✨ [추가] 비디오 송신자를 찾아 ref에 저장하는 함수
    const findVideoSender = () => {
      if (peer._pc) { // _pc는 simple-peer의 내부 RTCPeerConnection 객체입니다.
        const sender = peer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          videoSenderRef.current = sender;
          console.log('[useCallQuality] Video sender found.');
        }
      }
    };
    
    // ✨ [수정] 통화 품질을 평가하고 그에 따라 인코딩 설정을 동적으로 변경하는 함수
    const assessAndApplyQuality = (stats) => {
      let score = 100;
      let packetsLost = 0;
      let roundTripTime = 0;

      stats.forEach(report => {
        if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
          packetsLost = report.packetsLost;
          roundTripTime = report.roundTripTime;

          if (packetsLost > 10) score -= 50;
          else if (packetsLost > 5) score -= 25;
          else if (packetsLost > 2) score -= 10;

          if (roundTripTime > 0.5) score -= 40; // 500ms
          else if (roundTripTime > 0.25) score -= 20; // 250ms
        }
      });
      
      let newQuality = 'poor';
      if (score >= 80) newQuality = 'good';
      else if (score >= 50) newQuality = 'average';

      setQuality(newQuality);

      // 품질 상태가 변경되었을 때만 파라미터를 업데이트합니다.
      if (newQuality !== lastQualityRef.current && videoSenderRef.current) {
        const sender = videoSenderRef.current;
        const params = sender.getParameters();
        
        if (!params.encodings) {
          params.encodings = [{}];
        }

        const settings = QUALITY_SETTINGS[newQuality];
        params.encodings[0].maxBitrate = settings.maxBitrate;
        params.encodings[0].scaleResolutionDownBy = settings.scaleResolutionDownBy;

        sender.setParameters(params)
          .then(() => {
            console.log(`[useCallQuality] Quality changed to ${newQuality}. Video parameters updated.`, settings);
          })
          .catch(err => {
            console.error('[useCallQuality] Error setting video parameters:', err);
          });
        
        lastQualityRef.current = newQuality;
      }
    };

    const monitorStats = () => {
      if (peer && !peer.destroyed && peer.connected) {
        peer.getStats((err, stats) => {
          if (err) {
            console.error('Error getting WebRTC stats:', err);
            return;
          }
          assessAndApplyQuality(stats);
        });
      }
    };
    
    const handleConnect = () => {
      console.log('[useCallQuality] Peer connected. Starting quality monitoring.');
      findVideoSender();
      intervalRef.current = setInterval(monitorStats, 5000);
    }

    const handleClose = () => {
      console.log('[useCallQuality] Peer disconnected. Stopping quality monitoring.');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      videoSenderRef.current = null;
    }

    peer.on('connect', handleConnect);
    peer.on('close', handleClose);

    return () => {
      peer.off('connect', handleConnect);
      peer.off('close', handleClose);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [peer]);

  return quality;
}