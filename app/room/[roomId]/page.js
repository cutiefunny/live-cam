// app/room/[roomId]/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Video from '@/components/Video';
import Controls from '@/components/Controls';
import { useAuth } from '@/hooks/useAuth';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useRoom } from '@/hooks/useRoom';
import styles from './Room.module.css';

export default function Room() {
  const { roomId } = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userVideo = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [mediaStatus, setMediaStatus] = useState('loading'); 
  
  const { createPeer, addPeer, iceServersReady } = useWebRTC(user, roomId);
  
  // ✨ localStream 없이 useRoom 훅 호출
  const { peers } = useRoom(
    roomId,
    user,
    createPeer,
    addPeer
  );
  
  console.log('[RoomPage] Component rendering.');
  
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
                if (userVideo.current) {
                    userVideo.current.srcObject = stream;
                }
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

  // ✨ 해결책: 피어가 생성되고 로컬 스트림이 준비되면 스트림을 연결합니다.
  useEffect(() => {
    if (mediaStatus === 'ready' && localStream && peers.length > 0) {
      peers.forEach(({ peer, peerID }) => {
        // 이미 스트림이 추가되었는지 확인하여 중복 추가를 방지합니다.
        if (peer.streams.length === 0) {
          console.log(`[RoomPage] Attaching local stream to peer: ${peerID}`);
          peer.addStream(localStream);
        }
      });
    }
  }, [localStream, peers, mediaStatus]);

  // 통화 미응답/거절 처리 타임아웃
  useEffect(() => {
    if (!user || (mediaStatus !== 'ready' && mediaStatus !== 'spectator') || !iceServersReady) return;

    const timeoutId = setTimeout(() => {
      if (peers.length === 0) {
        console.log('[RoomPage] Timeout: No peers connected after 20 seconds.');
        alert("Call not answered or declined.");
        router.push('/');
      }
    }, 20000);

    if (peers.length > 0) {
      clearTimeout(timeoutId);
    }

    return () => clearTimeout(timeoutId);
  }, [peers, user, mediaStatus, router, iceServersReady]);

  useEffect(() => {
    console.log('[RoomPage] ICE server status:', { iceServersReady });
  }, [iceServersReady]);
  
  const handleLeaveRoom = () => {
      router.push('/');
  }

  if (isAuthLoading || !user || mediaStatus === 'loading' || !iceServersReady) {
      console.log('[RoomPage] Showing loading screen:', { isAuthLoading, user: !!user, mediaStatus, iceServersReady });
      return (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
            <div style={{fontSize: '1.25rem'}}>Connecting...</div>
        </div>
      );
  }

  const mainPeer = peers[0];
  
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.roomInfo}>Room: <span className={styles.roomId}>{roomId}</span></h1>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spectatorIcon}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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
        </footer>
      )}
    </div>
  );
}