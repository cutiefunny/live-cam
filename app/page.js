// app/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import Video from '../components/Video';
// 🔥 분리된 Firebase 설정 파일을 가져옵니다.
import { database, auth } from '../lib/firebase';
import { ref, onChildAdded, push, set, onChildRemoved, remove } from 'firebase/database';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";


export default function Home() {
  const [user, setUser] = useState(null); // 사용자 정보 상태
  const [peers, setPeers] = useState([]);
  const userVideo = useRef();
  const peersRef = useRef([]);
  const [usersInRoom, setUsersInRoom] = useState({});
  const roomID = "test-room"; // 예시 방 ID
  
  // Google 로그인 처리
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  // 로그아웃 처리
  const handleSignOut = async () => {
    if (!user) return;
    const userRef = ref(database, `rooms/${roomID}/users/${user.uid}`);
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);
    await remove(userRef);
    await remove(signalsRef);
    await signOut(auth);
    setUser(null);
    setPeers([]);
    peersRef.current = [];
    if (userVideo.current && userVideo.current.srcObject) {
        userVideo.current.srcObject.getTracks().forEach(track => track.stop());
        userVideo.current.srcObject = null;
    }
  };


  // 인증 상태 감시
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!user) return; // 사용자가 로그인하지 않았으면 아무것도 하지 않음

    let localStream = null;

    // WebRTC 및 데이터베이스 리스너 설정
    const setupWebRTC = (stream) => {
      localStream = stream;
      if(userVideo.current) {
        userVideo.current.srcObject = stream;
      }
      
      const usersRef = ref(database, `rooms/${roomID}/users`);

      // 방에 있는 다른 사용자 정보 가져오기
      onChildAdded(usersRef, (snapshot) => {
        const otherUserId = snapshot.key;
        const userData = snapshot.val();
        if (otherUserId === user.uid) return;

        setUsersInRoom(prev => ({...prev, [otherUserId]: userData}));
        
        const peer = createPeer(otherUserId, user.uid, stream);
        const peerRefObj = { peerID: otherUserId, peer, photoURL: userData.photoURL };
        peersRef.current.push(peerRefObj);
        setPeers(prevPeers => [...prevPeers, peerRefObj]);
      });
      
      onChildRemoved(usersRef, (snapshot) => {
          const removedUserId = snapshot.key;
          setUsersInRoom(prev => {
            const newUsers = {...prev};
            delete newUsers[removedUserId];
            return newUsers;
          });
          const item = peersRef.current.find(p => p.peerID === removedUserId);
          if (item) {
              item.peer.destroy();
          }
          const newPeers = peersRef.current.filter(p => p.peerID !== removedUserId);
          peersRef.current = newPeers;
          setPeers(newPeers);
      });

      // 현재 사용자 정보를 데이터베이스에 추가
      set(ref(database, `rooms/${roomID}/users/${user.uid}`), { photoURL: user.photoURL, displayName: user.displayName });

      // Signal 리스너 설정
      const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);
      onChildAdded(signalsRef, (snapshot) => {
        const { senderId, signal, senderPhotoURL } = snapshot.val();
        if (senderId === user.uid) return;

        const item = peersRef.current.find(p => p.peerID === senderId);
        if (item) {
          item.peer.signal(signal);
        } else {
          const peer = addPeer(signal, senderId, stream);
          const peerRefObj = { peerID: senderId, peer, photoURL: senderPhotoURL };
          peersRef.current.push(peerRefObj);
          setPeers(prevPeers => [...prevPeers, peerRefObj]);
        }
        remove(snapshot.ref); // Signal 처리 후 삭제
      });
    };
    
    // 미디어 스트림 가져오기
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setupWebRTC(stream);
    }).catch(err => {
        console.error("Failed to get media stream", err);
    });

    // 페이지를 떠날 때 정리
    const cleanup = () => {
        if (user) {
            const userRef = ref(database, `rooms/${roomID}/users/${user.uid}`);
            remove(userRef);
        }
    };

    window.addEventListener('beforeunload', cleanup);

    return () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        cleanup();
        peersRef.current.forEach(p => p.peer.destroy());
        peersRef.current = [];
        setPeers([]);
        window.removeEventListener('beforeunload', cleanup);
    }
  }, [user]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
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
      set(signalRef, { senderId: callerID, signal, senderPhotoURL: user.photoURL });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
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
      set(signalRef, { senderId: user.uid, signal, senderPhotoURL: user.photoURL });
    });

    peer.signal(incomingSignal);
    return peer;
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <button onClick={signInWithGoogle} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
          Login with Google
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Next.js Video Chat</h1>
        <button onClick={handleSignOut} style={{ padding: '8px 15px' }}>Logout</button>
      </div>

      <div style={{ position: 'relative', width: "300px", margin: "10px", backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
        <video muted ref={userVideo} autoPlay playsInline style={{ width: "100%", display: 'block' }} />
        {user.photoURL && (
            <img
            src={user.photoURL}
            alt="My Profile"
            style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid white'
            }}
            />
        )}
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {peers.map(({ peerID, peer, photoURL }) => {
          return <Video key={peerID} peer={peer} photoURL={photoURL} />;
        })}
      </div>
    </div>
  );
}

