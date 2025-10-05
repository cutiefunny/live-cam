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
  const { user, isLoading: isAuthLoading, signOut } = useAuth();
  const userVideo = useRef();
  
  const [localStream, setLocalStream] = useState(null);
  const [mediaStatus, setMediaStatus] = useState('loading'); 
  
  // 👇 FIX: useWebRTC 훅에서 iceServersReady 상태를 받아옵니다.
  const { createPeer, addPeer, iceServersReady } = useWebRTC(user, roomId);
  
  const { peers } = useRoom(
    roomId,
    user,
    // mediaStatus가 'ready'이고 iceServers가 준비되었을 때만 stream을 전달합니다.
    mediaStatus !== 'loading' && iceServersReady ? localStream : undefined,
    createPeer,
    addPeer
  );
  
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/');
      return;
    }
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }
        setMediaStatus('ready');
      })
      .catch(err => {
        console.warn("미디어 장치에 접근할 수 없습니다. 관전 모드로 참여합니다.", err);
        setLocalStream(null);
        setMediaStatus('spectator');
      });

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isAuthLoading, user, router]);
  
  const handleSignOut = async () => {
      await signOut();
      router.push('/');
  }

  // 👇 FIX: iceServers가 준비될 때까지 로딩 상태를 유지합니다.
  if (isAuthLoading || !user || mediaStatus === 'loading' || !iceServersReady) {
      return (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
            <div style={{fontSize: '1.25rem'}}>Connecting...</div>
        </div>
      );
  }
  
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.roomInfo}>Room: <span className={styles.roomId}>{roomId}</span></h1>
        <button onClick={handleSignOut} className={styles.exitButton}>
          나가기
        </button>
      </header>
      
      <main className={styles.main}>
        {mediaStatus === 'ready' ? (
            <div className={styles.myVideoContainer}>
                <video muted ref={userVideo} autoPlay playsInline className={styles.video} />
                {user.photoURL && (
                    <img src={user.photoURL} alt="My Profile" className={styles.profileImage}/>
                )}
                <div className={styles.displayName}>
                  {user.displayName} (나)
                </div>
            </div>
        ) : (
            <div className={styles.spectatorMode}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spectatorIcon}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <h3 className={styles.spectatorTitle}>관전 모드</h3>
              <p>카메라/마이크 없이 참여 중입니다.</p>
            </div>
        )}
        
        {peers.map(({ peerID, peer, photoURL, displayName }) => (
          <Video key={peerID} peer={peer} photoURL={photoURL} displayName={displayName} />
        ))}
      </main>
      
      {mediaStatus === 'ready' && (
        <footer className={styles.footer}>
          <Controls stream={localStream} onShareScreen={() => {}} />
        </footer>
      )}
    </div>
  );
}