// hooks/useCallQuality.js
import { useState, useEffect, useRef } from 'react';

export function useCallQuality(peer) {
  const [quality, setQuality] = useState('good'); // 'good', 'average', 'poor'
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!peer || peer.destroyed) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    const assessQuality = (stats) => {
        let score = 100;
        let packetsLost = 0;
        let roundTripTime = 0;

        stats.forEach(report => {
            if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                packetsLost = report.packetsLost;
                roundTripTime = report.roundTripTime;

                // 패킷 손실에 따른 점수 차감 (5개 이상부터 급격히 차감)
                if (packetsLost > 10) score -= 50;
                else if (packetsLost > 5) score -= 25;
                else if (packetsLost > 2) score -= 10;

                // RTT에 따른 점수 차감 (ms 단위)
                if (roundTripTime > 0.5) score -= 40; // 500ms
                else if (roundTripTime > 0.25) score -= 20; // 250ms
            }
        });
        
        if (score >= 80) setQuality('good');
        else if (score >= 50) setQuality('average');
        else setQuality('poor');
    };

    const monitorStats = () => {
      if (peer && !peer.destroyed && peer.connected) {
        peer.getStats((err, stats) => {
          if (err) {
            console.error('Error getting WebRTC stats:', err);
            return;
          }
          assessQuality(stats);
        });
      }
    };
    
    // 연결이 완료된 후에 모니터링 시작
    const handleConnect = () => {
        console.log('[useCallQuality] Peer connected. Starting quality monitoring.');
        intervalRef.current = setInterval(monitorStats, 5000); // 5초마다 품질 체크
    }

    const handleClose = () => {
        console.log('[useCallQuality] Peer disconnected. Stopping quality monitoring.');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
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