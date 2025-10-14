// app/room/[roomId]/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSettings } from '@/hooks/useSettings';
import { useCoin } from '@/hooks/useCoin';
import { useCallQuality } from '@/hooks/useCallQuality';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { useRoomEvents } from '@/hooks/useRoomEvents';
import { useCallHandler } from '@/hooks/useCallHandler';
import useAppStore from '@/store/useAppStore';
import { createDummyStream } from '@/lib/utils'; // ✨ [수정]

import LeaveConfirmModal from '@/components/LeaveConfirmModal';
import GiftModal from '@/components/GiftModal';
import GiftAnimation from '@/components/room/GiftAnimation'; // ✨ [수정]
import CallHeader from '@/components/room/CallHeader'; // ✨ [추가]
import VideoGrid from '@/components/room/VideoGrid'; // ✨ [추가]
import CallFooter from '@/components/room/CallFooter'; // ✨ [추가]
import styles from './Room.module.css';


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

  // 1. 미디어 스트림 초기화
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

  // 2. 커스텀 훅으로 로직 관리
  useRoomPresence(roomId, user, isCreator);
  const { participants } = useRoomEvents(roomId);
  const { peer, connections, remoteStreams, callPeer, disconnectAll } = useWebRTC(myStream);
  
  // 3. 상대방 정보 및 스트림 특정
  const otherUser = participants.find(p => p.uid !== user?.uid);
  const remotePeerId = otherUser?.uid;
  const remoteStream = remotePeerId ? remoteStreams[remotePeerId] : null;

  const { executeLeaveRoom, callStartTimeRef } = useCallHandler(remoteStream, otherUser ? {...otherUser, roomId} : null);
  const callQuality = useCallQuality(remotePeerId ? connections[remotePeerId] : null);


  // 4. WebRTC 통화 연결 로직
  useEffect(() => {
    if (peer && otherUser && !connections[otherUser.uid] && user.uid > otherUser.uid) {
        callPeer(otherUser.uid);
    }
  }, [peer, otherUser, connections, callPeer, user?.uid]);
  
  // 5. 통화 종료 로직
  const handleLeaveRoom = useCallback(() => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    
    const duration = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
    
    setLeaveDetails({ duration });
    setIsLeaveModalOpen(true);
  }, [callStartTimeRef]);

  // 6. 로딩 상태 렌더링
  if (isAuthLoading || isSettingsLoading || !user || !myStream) {
    return <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '1.25rem'}}>Loading...</div>;
  }
  
  // 7. 메인 렌더링
  return (
    <div className={styles.container}>
      <GiftAnimation />
      <CallHeader
        roomId={roomId}
        quality={callQuality}
        onLeave={handleLeaveRoom}
        hasRemoteStream={!!remoteStream}
      />
      <VideoGrid
        myStream={myStream}
        remoteStream={remoteStream}
        user={user}
        otherUser={otherUser}
      />
      <CallFooter
        stream={myStream}
        isCreator={isCreator}
        hasOtherUser={!!otherUser}
        onGiftClick={() => setIsGiftModalOpen(true)}
      />
      
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