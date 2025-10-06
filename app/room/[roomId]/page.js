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
  
  // localStream을 state 대신 ref로 관리하여 이중 실행의 영향을 받지 않도록 합니다.
  const localStreamRef = useRef(null);
  // localStream 상태는 UI 렌더링을 위해 별도로 유지합니다.
  const [localStream, setLocalStream] = useState(null);

  const [mediaStatus, setMediaStatus] = useState('loading'); 
  
  const { createPeer, addPeer, iceServersReady } = useWebRTC(user, roomId);
  
  // useRoom 훅에는 state인 localStream을 전달하여, 스트림이 준비되었을 때 훅이 실행되도록 합니다.
  const { peers } = useRoom(
    roomId,
    user,
    mediaStatus !== 'loading' && iceServersReady ? localStream : undefined,
    createPeer,
    addPeer
  );
  
  console.log('[RoomPage] Component rendering.');
  
  useEffect(() => {
    console.log('[RoomPage] Auth state changed:', { isAuthLoading, user: user ? user.uid : null });
    if (!isAuthLoading && !user) {
      console.log('[RoomPage] Not authenticated, redirecting to home.');
      router.push('/');
      return;
    }
    
    console.log('[RoomPage] Media devices effect running.');
    
    // 이미 스트림이 할당되어 있다면 다시 요청하지 않습니다.
    if (localStreamRef.current) return;

    let isComponentMounted = true;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (isComponentMounted) {
            console.log('[RoomPage] getUserMedia success. Stream acquired.');
            localStreamRef.current = stream; // Ref에 스트림 인스턴스 저장
            setLocalStream(stream); // State 업데이트로 리렌더링 유발
            if (userVideo.current) {
              userVideo.current.srcObject = stream;
            }
            setMediaStatus('ready');
        }
      })
      .catch(err => {
        if (isComponentMounted) {
            console.error("[RoomPage] getUserMedia error. Joining as spectator.", err);
            setLocalStream(null);
            setMediaStatus('spectator');
        }
      });

    return () => {
      // 컴포넌트가 완전히 언마운트될 때만 스트림을 정리합니다.
      // isComponentMounted 플래그를 사용하여 이중 실행 시의 조기 정리를 방지할 수 있습니다.
      isComponentMounted = false;
      // 페이지를 떠날 때(컴포넌트 언마운트) 스트림을 확실히 종료합니다.
      if (localStreamRef.current) {
        console.log('[RoomPage] Cleaning up and stopping local stream tracks.');
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [isAuthLoading, user, router]);


  // 통화 미응답/거절 처리 타임아웃
  useEffect(() => {
    if (!user || (mediaStatus !== 'ready' && mediaStatus !== 'spectator')) return;

    const timeoutId = setTimeout(() => {
      // 20초 후에도 피어가 없으면 메인으로 리디렉션
      if (peers.length === 0) {
        console.log('[RoomPage] Timeout: No peers connected after 20 seconds.');
        alert("Call not answered or declined.");
        router.push('/');
      }
    }, 20000);

    // 피어가 연결되면 타임아웃 해제
    if (peers.length > 0) {
      clearTimeout(timeoutId);
    }

    return () => clearTimeout(timeoutId);
  }, [peers, user, mediaStatus, router]);

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
        {/* Local Video in Picture-in-Picture */}
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
        
        {/* Main Remote Video */}
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
      
      {mediaStatus === 'ready' && (
        <footer className={styles.footer}>
          <Controls stream={localStream} onShareScreen={() => {}} />
        </footer>
      )}
    </div>
  );
}