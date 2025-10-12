// app/room/[roomId]/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';
import { useCoin } from '@/hooks/useCoin';
import { useCallQuality } from '@/hooks/useCallQuality';
import { useRoom } from '@/hooks/useRoom'; // ✨ 수정
import { useCallHandler } from '@/hooks/useCallHandler'; 
import useAppStore from '@/store/useAppStore';

import Video from '@/components/Video';
import Controls from '@/components/Controls';
import LeaveConfirmModal from '@/components/LeaveConfirmModal';
import GiftModal from '@/components/GiftModal';
import CallQualityIndicator from '@/components/CallQualityIndicator';
import styles from './Room.module.css';


const GiftAnimation = () => {
  const { giftAnimation, setGiftAnimation } = useAppStore();

  useEffect(() => {
    if (giftAnimation) {
      const timer = setTimeout(() => {
        setGiftAnimation(null);
      }, 3000); 

      return () => clearTimeout(timer);
    }
  }, [giftAnimation, setGiftAnimation]);

  if (!giftAnimation) return null;

  return (
    <div className={styles.giftAnimationOverlay}>
      <div className={styles.giftAnimationContent}>
        <div className={styles.giftIcon}>{giftAnimation.icon}</div>
        <p>{giftAnimation.senderName}님이 {giftAnimation.name} 선물을 보냈습니다!</p>
      </div>
    </div>
  );
};


const createDummyStream = () => {
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


export default function Room() {
  const { roomId } = useParams();
  
  const { user, isAuthLoading, isCreator, showToast } = useAppStore();
  const { settings, isLoading: isSettingsLoading } = useSettings();
  const { sendGift } = useCoin();
  
  const [myStream, setMyStream] = useState(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState(null);

  const isLeavingRef = useRef(false);

  // 1. Initialize media stream
  useEffect(() => {
    let streamInstance = null;
    const initStream = async () => {
      try {
        streamInstance = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMyStream(streamInstance);
      } catch (err) {
        showToast('카메라/마이크 접근에 실패하여 관전자 모드로 참여합니다.', 'error');
        streamInstance = createDummyStream();
        setMyStream(streamInstance);
      }
    };
    initStream();
    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
      }
    };
  }, [showToast]);

  const { otherUser } = useRoom(roomId);
  const { peer, connections, remoteStreams, callPeer, disconnectAll } = useWebRTC(myStream);
  
  const remotePeerId = otherUser?.uid;
  const remoteStream = remotePeerId ? remoteStreams[remotePeerId] : null;

  const { executeLeaveRoom, callStartTimeRef } = useCallHandler(remoteStream, otherUser ? {...otherUser, roomId} : null);
  const callQuality = useCallQuality(remotePeerId ? connections[remotePeerId] : null);


  // WebRTC: Call other user when they join
  useEffect(() => {
    if (peer && otherUser && !connections[otherUser.uid] && !remoteStreams[otherUser.uid]) {
      if (user.uid > otherUser.uid) {
        callPeer(otherUser.uid);
      }
    }
  }, [peer, otherUser, connections, remoteStreams, callPeer, user?.uid]);
  
  // Leave Room Logic
  const handleLeaveRoom = useCallback((immediate = false) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    
    const duration = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
    
    if (immediate) {
        disconnectAll();
        executeLeaveRoom(duration);
        return;
    }
    
    setLeaveDetails({ duration });
    setIsLeaveModalOpen(true);
  }, [executeLeaveRoom, disconnectAll, callStartTimeRef]);

  if (isAuthLoading || isSettingsLoading || !user) {
    return <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1.25rem'}}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <GiftAnimation />
      <header className={styles.header}>
        <h1 className={styles.roomInfo}>Room: <span className={styles.roomId}>{roomId}</span></h1>
        {remoteStream && <CallQualityIndicator quality={callQuality} />}
        <button onClick={() => handleLeaveRoom(false)} className={styles.exitButton}>Leave Room</button>
      </header>
      <main className={styles.main}>
        {myStream && (
            <div className={styles.myVideoContainer}>
                <Video stream={myStream} muted={true} />
                <div className={styles.displayName}>{user.displayName} (You)</div>
            </div>
        )}
        {remoteStream && otherUser ? (
          <div className={styles.remoteVideoContainer}>
            <Video 
              stream={remoteStream} 
              photoURL={otherUser.photoURL} 
              displayName={otherUser.displayName} 
            />
          </div>
        ) : (
          <div className={styles.waitingMessage}>
            <h2>Waiting for other participant...</h2>
          </div>
        )}
      </main>
      {myStream && (
        <footer className={styles.footer}>
          <Controls stream={myStream} />
          {!isCreator && otherUser && (
            <button onClick={() => setIsGiftModalOpen(true)} className={styles.giftButton}>
              🎁
            </button>
          )}
        </footer>
      )}
      {isGiftModalOpen && otherUser && (
        <GiftModal
          onClose={() => setIsGiftModalOpen(false)}
          onSendGift={(gift) => sendGift(user.uid, otherUser.uid, gift, roomId)}
        />
      )}
      <LeaveConfirmModal
        show={isLeaveModalOpen}
        onConfirm={() => {
            disconnectAll();
            executeLeaveRoom(leaveDetails.duration);
        }}
        onCancel={() => { setIsLeaveModalOpen(false); isLeavingRef.current = false; }}
        details={leaveDetails}
        isCreator={isCreator}
        settings={settings}
      />
    </div>
  );
}