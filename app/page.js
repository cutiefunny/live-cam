// app/page.js
'use client';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import Video from '../components/Video';

export default function Home() {
  const [peers, setPeers] = useState([]);
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const roomID = "test-room"; // 예시 방 ID

  useEffect(() => {
    socketRef.current = io.connect('http://210.114.17.65:8009'); // 시그널링 서버 주소
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if(userVideo.current) {
        userVideo.current.srcObject = stream;
      }

      socketRef.current.emit('join room', roomID);

      socketRef.current.on('other user', userID => {
        const peer = createPeer(userID, socketRef.current.id, stream);
        peersRef.current.push({
          peerID: userID,
          peer,
        });
        setPeers(users => [...users, peer]);
      });

      socketRef.current.on('user joined', payload => {
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({
          peerID: payload.callerID,
          peer,
        });
        setPeers(users => [...users, peer]);
      });

      socketRef.current.on('receiving returned signal', payload => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        item.peer.signal(payload.signal);
      });

      socketRef.current.on("user left", (id) => {
        const peerObj = peersRef.current.find(p => p.peerID === id);
        if(peerObj) {
          peerObj.peer.destroy();
        }
        const newPeers = peersRef.current.filter(p => p.peerID !== id);
        peersRef.current = newPeers;
        setPeers(newPeers.map(p => p.peer));
      });
    });

    return () => {
        if(socketRef.current) {
            socketRef.current.disconnect();
        }
        peers.forEach(peer => peer.destroy());
    }
  }, []);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socketRef.current.emit('sending signal', { userToSignal, callerID, signal });
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
      socketRef.current.emit('returning signal', { signal, callerID });
    });

    peer.signal(incomingSignal);
    return peer;
  }

  return (
    <div>
      <h1>Next.js Video Chat</h1>
      <video muted ref={userVideo} autoPlay playsInline style={{ width: "300px", margin: "10px" }} />
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {peers.map((peer, index) => {
          return <Video key={index} peer={peer} />;
        })}
      </div>
    </div>
  );
}