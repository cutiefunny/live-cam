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
  
  // 💡 Firebase 데이터베이스 참조를 생성합니다.
  const roomRef = ref(database, `rooms/${roomID}`);
  const [localId, setLocalId] = useState(null); // 자신의 고유 ID

  useEffect(() => {
    // 💡 자신의 고유 ID를 생성합니다.
    const id = Math.random().toString(36).substring(2, 15);
    setLocalId(id);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if(userVideo.current) {
        userVideo.current.srcObject = stream;
      }

      // 💡 방에 있는 다른 사용자들에게 내 존재를 알리고 연결을 시작합니다.
      const otherUsersRef = ref(database, `rooms/${roomID}/users`);
      onChildAdded(otherUsersRef, (snapshot) => {
        const otherUserId = snapshot.key;
        if (otherUserId === id) return; // 자기 자신은 제외

        const peer = createPeer(otherUserId, id, stream);
        peersRef.current.push({ peerID: otherUserId, peer });
        setPeers(prevPeers => [...prevPeers, peer]);
      });
      
      // 💡 내 정보를 방에 추가합니다.
      set(ref(database, `rooms/${roomID}/users/${id}`), true);

      // 💡 시그널링 데이터를 실시간으로 감지합니다.
      const signalsRef = ref(database, `rooms/${roomID}/signals/${id}`);
      onChildAdded(signalsRef, (snapshot) => {
        const { senderId, signal } = snapshot.val();

        if (senderId === id) return;

        const item = peersRef.current.find(p => p.peerID === senderId);
        if (item) {
          item.peer.signal(signal);
        } else {
          // 새로운 사용자가 들어왔을 때의 처리 (createPeer가 아닌 addPeer)
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
    });

    peer.on('signal', signal => {
      // 💡 시그널을 상대방에게 Firebase를 통해 보냅니다.
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
    });

    peer.on('signal', signal => {
      // 💡 응답 시그널을 상대방에게 Firebase를 통해 보냅니다.
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