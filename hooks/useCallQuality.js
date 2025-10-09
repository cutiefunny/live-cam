// hooks/useCallQuality.js
'use client';
import { useState, useEffect, useRef } from 'react';

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

export function useCallQuality(call) {
  const [quality, setQuality] = useState('good');
  const intervalRef = useRef(null);
  const lastQualityRef = useRef('good');
  const videoSenderRef = useRef(null);

  useEffect(() => {
    if (!call || !call.peerConnection) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const pc = call.peerConnection;

    const findVideoSender = () => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        videoSenderRef.current = sender;
        console.log('[useCallQuality] Video sender found.');
      }
    };
    
    const assessAndApplyQuality = (stats) => {
      let score = 100;
      let packetsLost = 0;
      let roundTripTime = 0;

      stats.forEach(report => {
        if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
          packetsLost = report.packetsLost || 0;
          roundTripTime = report.roundTripTime || 0;

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

      if (newQuality !== lastQualityRef.current && videoSenderRef.current) {
        const sender = videoSenderRef.current;
        const params = sender.getParameters();
        
        if (!params.encodings || params.encodings.length === 0) {
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
      if (pc && pc.connectionState === 'connected') {
        pc.getStats(null).then(assessAndApplyQuality).catch(err => {
          console.error('Error getting WebRTC stats:', err);
        });
      }
    };
    
    const handleConnect = () => {
      console.log('[useCallQuality] Peer connected. Starting quality monitoring.');
      findVideoSender();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(monitorStats, 5000);
    }

    const handleClose = () => {
      console.log('[useCallQuality] Peer disconnected. Stopping quality monitoring.');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      videoSenderRef.current = null;
    }

    const onConnectionStateChange = () => {
      if (pc.connectionState === 'connected') {
        handleConnect();
      } else if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
        handleClose();
      }
    };
    
    pc.addEventListener('connectionstatechange', onConnectionStateChange);
    call.on('close', handleClose);

    if (pc.connectionState === 'connected') {
      handleConnect();
    }

    return () => {
      pc.removeEventListener('connectionstatechange', onConnectionStateChange);
      call.off('close', handleClose);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [call]);

  return quality;
}