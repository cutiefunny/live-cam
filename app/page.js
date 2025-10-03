// app/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import Video from '../components/Video';
// 💡 Firebase 관련 모듈을 가져옵니다.
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onChildAdded, push, set } from 'firebase/database';

// 🚨 아래 Firebase 설정은 개발자님의 프로젝트 설정으로 교체해야 합니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: "https://you-and-me-5059c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export default function Home() {
  const [peers, setPeers] = useState([]);
  const userVideo = useRef();
  const peersRef = useRef([]);
  const roomID = "test-room"; // 예시 방 ID
  
  const roomRef = ref(database, `rooms/${roomID}`);
  const [localId, setLocalId] = useState(null);

  useEffect(() => {
    const id = Math.random().toString(36).substring(2, 15);
    setLocalId(id);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if(userVideo.current) {
        userVideo.current.srcObject = stream;
      }

      const otherUsersRef = ref(database, `rooms/${roomID}/users`);
      onChildAdded(otherUsersRef, (snapshot) => {
        const otherUserId = snapshot.key;
        if (otherUserId === id) return;

        const peer = createPeer(otherUserId, id, stream);
        peersRef.current.push({ peerID: otherUserId, peer });
        setPeers(prevPeers => [...prevPeers, peer]);
      });
      
      set(ref(database, `rooms/${roomID}/users/${id}`), true);

      const signalsRef = ref(database, `rooms/${roomID}/signals/${id}`);
      onChildAdded(signalsRef, (snapshot) => {
        const { senderId, signal } = snapshot.val();

        if (senderId === id) return;

        const item = peersRef.current.find(p => p.peerID === senderId);
        if (item) {
          item.peer.signal(signal);
        } else {
          const peer = addPeer(signal, senderId, stream);
          peersRef.current.push({ peerID: senderId, peer });
          setPeers(prevPeers => [...prevPeers, peer]);
        }
      });
    });

    return () => {
        peers.forEach(peer => peer.destroy());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      // ✅ STUN 서버 설정 추가
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
      },
    });

    peer.on('signal', signal => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${userToSignal}`));
      set(signalRef, { senderId: callerID, signal });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      // ✅ STUN 서버 설정 추가
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
      },
    });

    peer.on('signal', signal => {
      const signalRef = push(ref(database, `rooms/${roomID}/signals/${callerID}`));
      set(signalRef, { senderId: localId, signal });
    });

    peer.signal(incomingSignal);
    return peer;
  }

  return (
    <div>
      <h1>Next.js Video Chat with Firebase</h1>
      <video muted ref={userVideo} autoPlay playsInline style={{ width: "300px", margin: "10px" }} />
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {peers.map((peer, index) => {
          return <Video key={index} peer={peer} />;
        })}
      </div>
    </div>
  );
}