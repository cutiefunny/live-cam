// app/room/[roomId]/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Video from '@/components/Video';
import Controls from '@/components/Controls';
import CallQualityIndicator from '@/components/CallQualityIndicator';
import GiftModal from '@/components/GiftModal';
import { useAuth } from '@/hooks/useAuth';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useRoom } from '@/hooks/useRoom';
import { useSettings } from '@/hooks/useSettings';
import { useCallQuality } from '@/hooks/useCallQuality';
import useAppStore from '@/store/useAppStore';
import styles from './Room.module.css';

export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();
  const { sendGift } = useAuth();
  
  const user = useAppStore((state) => state.user);
  const isAuthLoading = useAppStore((state) => state.isAuthLoading);
  const isCreator = useAppStore((state) => state.isCreator);
  const giftAnimation = useAppStore((state) => state.giftAnimation);
  const setGiftAnimation = useAppStore((state) => state.setGiftAnimation);

  const { settings, isLoading: isSettingsLoading } = useSettings();
  const userVideo = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [mediaStatus, setMediaStatus] = useState('loading'); 
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  
  const { createPeer, addPeer, iceServersReady } = useWebRTC(user, roomId);
  
  const { peers } = useRoom(
    roomId,
    user,
    localStream,
    createPeer,
    addPeer,
    iceServersReady,
    settings,
    isCreator
  );

  const mainPeer = peers[0];
  const callQuality = useCallQuality(mainPeer?.peer);

  // ✨ [추가] 통화가 정상적으로 종료되었는지 추적하기 위한 ref
  const callEndedRef = useRef(false);
  
  console.log('[RoomPage] Component rendering.');

  useEffect(() => {
    if (giftAnimation) {
      const timer = setTimeout(() => {
        setGiftAnimation(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [giftAnimation, setGiftAnimation]);
  
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    console.log('[RoomPage] Media devices effect running.');
    
    let isEffectActive = true;

    async function getMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (isEffectActive) {
                console.log('[RoomPage] getUserMedia success. Stream acquired.');
                setLocalStream(stream);
                setMediaStatus('ready');
            }
        } catch (err) {
            if (isEffectActive) {
                console.error("[RoomPage] getUserMedia error. Joining as spectator.", err);
                setMediaStatus('spectator');
            }
        }
    }

    getMedia();

    return () => {
      isEffectActive = false;
      setLocalStream(currentStream => {
        if (currentStream) {
            console.log('[RoomPage] Cleaning up and stopping local stream tracks.');
            currentStream.getTracks().forEach(track => track.stop());
        }
        return null;
      });
    };
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (userVideo.current && localStream && mediaStatus === 'ready') {
      console.log('[RoomPage] Attaching local stream to video element.');
      userVideo.current.srcObject = localStream;
      userVideo.current.play().catch(error => {
        console.error('Error attempting to play local video:', error);
      });
    }
  }, [localStream, mediaStatus]);

  useEffect(() => {
    if (!user || (mediaStatus !== 'ready' && mediaStatus !== 'spectator') || !iceServersReady) return;

    if (peers.length > 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!callEndedRef.current && peers.length === 0) {
        console.log('[RoomPage] Timeout: No peers connected after 20 seconds.');
        alert("상대방이 응답하지 않아 통화를 종료합니다.");
        router.push('/');
      }
    }, 20000);

    return () => clearTimeout(timeoutId);
  }, [peers, user, mediaStatus, router, iceServersReady]);

  useEffect(() => {
    console.log('[RoomPage] ICE server status:', { iceServersReady });
  }, [iceServersReady]);
  
  // ✨ [수정] 방 나가기 핸들러
  const handleLeaveRoom = () => {
    callEndedRef.current = true; // 정상 종료로 표시
    if (!isCreator && mainPeer) {
      const query = `?callEnded=true&creatorId=${mainPeer.peerID}&creatorName=${mainPeer.displayName}`;
      router.push(`/${query}`);
    } else {
      router.push('/');
    }
  }

  const handleSendGift = async (gift) => {
    if (!user || !mainPeer) return;
    await sendGift(user.uid, mainPeer.peerID, gift, roomId);
  };

  if (isAuthLoading || isSettingsLoading || !user || mediaStatus === 'loading' || !iceServersReady) {
      console.log('[RoomPage] Showing loading screen:', { isAuthLoading, isSettingsLoading, user: !!user, mediaStatus, iceServersReady });
      return (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
            <div style={{fontSize: '1.25rem'}}>Connecting...</div>
        </div>
      );
  }
  
  return (
    <div className={styles.container}>
      {giftAnimation && (
        <div className={styles.giftAnimationOverlay}>
          <div className={styles.giftAnimationContent}>
            <span className={styles.giftIcon}>{giftAnimation.icon}</span>
            <p>{giftAnimation.senderName}님이 {giftAnimation.name} 선물을 보냈습니다!</p>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.roomInfo}>Room: <span className={styles.roomId}>{roomId}</span></h1>
        {mainPeer && <CallQualityIndicator quality={callQuality} />}
        <button onClick={handleLeaveRoom} className={styles.exitButton}>
          Leave Room
        </button>
      </header>
      
      <main className={styles.main}>
        {mediaStatus === 'ready' ? (
            <div className={styles.myVideoContainer}>
                <video muted ref={userVideo} autoPlay playsInline className={styles.video} />
                <div className={styles.displayName}>
                  {user.displayName} (You)
                </div>
            </div>
        ) : (
          <div className={styles.spectatorPip}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spectatorIcon}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <p>Spectator Mode</p>
          </div>
        )}
        
        {mainPeer ? (
          <div className={styles.remoteVideoContainer}>
            <Video 
              key={mainPeer.peerID} 
              peer={mainPeer.peer} 
              photoURL={mainPeer.photoURL} 
              displayName={mainPeer.displayName} 
            />
          </div>
        ) : (
          <div className={styles.waitingMessage}>
            <h2>Waiting for other participant...</h2>
          </div>
        )}
      </main>
      
      {mediaStatus === 'ready' && localStream && (
        <footer className={styles.footer}>
          <Controls stream={localStream} onShareScreen={() => {}} />
          {!isCreator && mainPeer && (
            <button onClick={() => setIsGiftModalOpen(true)} className={styles.giftButton}>
              🎁
            </button>
          )}
        </footer>
      )}

      {isGiftModalOpen && (
        <GiftModal
          onClose={() => setIsGiftModalOpen(false)}
          onSendGift={handleSendGift}
        />
      )}
    </div>
  );
}