// app/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import Video from '../components/Video';
// 🔥 분리된 Firebase 설정 파일을 가져옵니다.
import { database, auth } from '../lib/firebase';
// 🔥 'serverTimestamp'를 추가로 import하여 입장 시간을 기록합니다.
import { ref, onChildAdded, push, set, onChildRemoved, remove, get, serverTimestamp } from 'firebase/database';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";


export default function Home() {
  const [user, setUser] = useState(null); // 사용자 정보 상태
  const [peers, setPeers] = useState([]);
  const userVideo = useRef();
  const peersRef = useRef([]);
  const [usersInRoom, setUsersInRoom] = useState({});
  const roomID = "test-room"; // 예시 방 ID
  const [errorMessage, setErrorMessage] = useState('');
  const [hasCamera, setHasCamera] = useState(true);
  
  // Google 로그인 처리
  const signInWithGoogle = async () => {
    setErrorMessage('');
    const roomUsersRef = ref(database, `rooms/${roomID}/users`);
    try {
        const snapshot = await get(roomUsersRef);
        
        // 🔥 FIX: 방이 가득 찼을 때, 가장 오래된 사용자를 내보내는 '큐' 방식으로 변경
        if (snapshot.exists() && snapshot.size >= 2) {
            let oldestUid = null;
            let oldestTimestamp = Infinity;
            snapshot.forEach((childSnapshot) => {
                const userData = childSnapshot.val();
                if (userData.joinedAt < oldestTimestamp) {
                    oldestTimestamp = userData.joinedAt;
                    oldestUid = childSnapshot.key;
                }
            });

            if (oldestUid) {
                console.log(`Room is full. Removing oldest user: ${oldestUid}`);
                const oldestUserRef = ref(database, `rooms/${roomID}/users/${oldestUid}`);
                const oldestUserSignalsRef = ref(database, `rooms/${roomID}/signals/${oldestUid}`);
                await remove(oldestUserRef);
                await remove(oldestUserSignalsRef);
            }
        }

        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Authentication or room management error:", error);
        setErrorMessage("오류가 발생했습니다. 다시 시도해주세요.");
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
    if (!user) return;

    let localStream = null;

    const setupListenersAndJoinRoom = (stream) => {
      localStream = stream;
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
      
      const usersRef = ref(database, `rooms/${roomID}/users`);

      onChildAdded(usersRef, (snapshot) => {
        const otherUserId = snapshot.key;
        const userData = snapshot.val();
        if (otherUserId === user.uid) return;

        setUsersInRoom(prev => ({...prev, [otherUserId]: userData}));
        
        if (user.uid > otherUserId) {
            const peer = createPeer(otherUserId, user.uid, stream);
            const peerRefObj = { peerID: otherUserId, peer, photoURL: userData.photoURL };
            peersRef.current.push(peerRefObj);
            setPeers(prevPeers => [...prevPeers, peerRefObj]);
        }
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

      // 🔥 FIX: 사용자가 방에 참여할 때, 서버 시간을 기준으로 'joinedAt' 타임스탬프를 기록
      set(ref(database, `rooms/${roomID}/users/${user.uid}`), { 
          photoURL: user.photoURL, 
          displayName: user.displayName,
          joinedAt: serverTimestamp() 
      });

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
        remove(snapshot.ref);
      });
    };
    
    const getMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setHasCamera(true);
            setupListenersAndJoinRoom(stream);
        } catch (err) {
            console.error("Error getting media stream:", err);
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setHasCamera(false);
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    setupListenersAndJoinRoom(audioStream);
                } catch (audioErr) {
                    console.error("Error getting audio stream:", audioErr);
                    setErrorMessage("카메라 또는 마이크를 찾을 수 없습니다. 장치 설정을 확인해주세요.");
                }
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setHasCamera(false);
                setErrorMessage("카메라 및 마이크 접근 권한이 거부되었습니다.");
            }
        }
    };

    getMedia();

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

    peer.on('connect', () => console.log(`Connection established with ${userToSignal}`));
    peer.on('error', (err) => console.error(`Connection error with ${userToSignal}:`, err));

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

    peer.on('connect', () => console.log(`Connection established with ${callerID}`));
    peer.on('error', (err) => console.error(`Connection error with ${callerID}:`, err));

    peer.signal(incomingSignal);
    return peer;
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <button onClick={signInWithGoogle} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
          Google 계정으로 로그인하여 통화 참여
        </button>
        {errorMessage && <p style={{ color: 'red', marginTop: '15px' }}>{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Next.js 영상 채팅</h1>
        <button onClick={handleSignOut} style={{ padding: '8px 15px' }}>로그아웃</button>
      </div>

      <div style={{ position: 'relative', width: "300px", margin: "10px", backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
        {hasCamera ? (
            <video muted ref={userVideo} autoPlay playsInline style={{ width: "100%", display: 'block' }} />
        ) : (
            <div style={{ width: '300px', height: '225px', backgroundColor: '#2C2C2C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/images/icon-512.png" alt="카메라를 사용할 수 없음" style={{ width: '100px', height: '100px', opacity: 0.6 }} />
            </div>
        )}
        {user.photoURL && (
            <img
            src={user.photoURL}
            alt="내 프로필"
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

