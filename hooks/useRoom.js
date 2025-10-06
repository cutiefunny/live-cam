// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child, off } from 'firebase/database';
import { database } from '@/lib/firebase';

// ✨ iceServersReady를 매개변수로 추가합니다.
export function useRoom(roomID, user, localStream, createPeer, addPeer, iceServersReady) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  useEffect(() => {
    peersRef.current = peers;
    console.log('[Room] Peers state updated. Current peer IDs:', peers.map(p => p.peerID));
  }, [peers]);

  useEffect(() => {
    // ✨ iceServersReady 조건도 확인합니다.
    if (!user || !roomID || !localStream || !iceServersReady) {
      console.log('[Room] Main useEffect skipped. Conditions not met:', { hasUser: !!user, hasRoomID: !!roomID, hasLocalStream: !!localStream, iceServersReady });
      return;
    }

    console.log('[Room] Main useEffect running. Setting up Firebase listeners for room:', roomID);
    const roomRef = ref(database, `rooms/${roomID}`);
    const usersRef = child(roomRef, 'users');
    const currentUserRef = child(usersRef, user.uid);
    const signalsRef = ref(database, `rooms/${roomID}/signals/${user.uid}`);
    
    const creatorRef = ref(database, `creators/${user.uid}`);
    let isCurrentUserCreator = false;
    get(creatorRef).then(snapshot => {
        if(snapshot.exists()) {
            isCurrentUserCreator = true;
            set(child(creatorRef, 'status'), 'busy');
            onDisconnect(child(creatorRef, 'status')).set('offline');
        }
    });

    const handleUserJoined = (snapshot) => {
      const otherUserId = snapshot.key;
      const userData = snapshot.val();
      console.log(`[Room] Event: User ${otherUserId} joined.`, userData);
      
      if (otherUserId === user.uid) return;

      if (user.uid > otherUserId) {
        console.log(`[Room] Current user (${user.uid}) is initiator. Calling createPeer for ${otherUserId}.`);
        setPeers(currentPeers => {
          if (currentPeers.some(p => p.peerID === otherUserId)) {
            console.log(`[Room] Peer for ${otherUserId} already exists. Skipping createPeer.`);
            return currentPeers;
          }
          const peer = createPeer(otherUserId, localStream);
          if (!peer) return currentPeers;
          const newPeerObj = {
            peerID: otherUserId,
            peer,
            photoURL: userData.photoURL,
            displayName: userData.displayName,
          };
          return [...currentPeers, newPeerObj];
        });
      }
    };

    const handleSignal = (snapshot) => {
      const { senderId, signal, senderPhotoURL, senderDisplayName } = snapshot.val();
      console.log(`[Room] Event: Received signal from ${senderId}.`);

      if (senderId === user.uid) {
        remove(snapshot.ref);
        return;
      };

      const peerToSignal = peersRef.current.find(p => p.peerID === senderId);

      if (peerToSignal) {
        console.log(`[Room] Found existing peer for ${senderId}. Signaling...`);
        if (peerToSignal.peer && !peerToSignal.peer.destroyed) {
          peerToSignal.peer.signal(signal);
        }
      } else {
        if (signal.type === 'offer' && user.uid < senderId) {
          console.log(`[Room] No existing peer. Current user (${user.uid}) is receiver. Calling addPeer for ${senderId}.`);
          setPeers(currentPeers => {
            if (currentPeers.some(p => p.peerID === senderId)) {
              return currentPeers;
            }
            const peer = addPeer(signal, senderId, localStream);
            if (!peer) return currentPeers;
            const newPeerObj = {
              peerID: senderId,
              peer,
              photoURL: senderPhotoURL,
              displayName: senderDisplayName,
            };
            return [...currentPeers, newPeerObj];
          });
        }
      }
      remove(snapshot.ref);
    };

    const handleUserLeft = (snapshot) => {
      const removedUserId = snapshot.key;
      console.log(`[Room] Event: User ${removedUserId} left.`);
      const peerToRemove = peersRef.current.find(p => p.peerID === removedUserId);
      
      if (peerToRemove && peerToRemove.peer && !peerToRemove.peer.destroyed) {
          peerToRemove.peer.destroy();
      }

      setPeers(currentPeers => currentPeers.filter(p => p.peerID !== removedUserId));
    };
    
    console.log(`[Room] User ${user.uid} setting presence in room ${roomID}.`);
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName });
    onDisconnect(currentUserRef).remove();
    
    const userJoinedListener = onChildAdded(usersRef, handleUserJoined);
    const userLeftListener = onChildRemoved(usersRef, handleUserLeft);
    const signalListener = onChildAdded(signalsRef, handleSignal);

    return () => {
      console.log(`[Room] Cleaning up room ${roomID} for user ${user.uid}.`);
      off(usersRef, 'child_added', userJoinedListener);
      off(usersRef, 'child_removed', userLeftListener);
      off(signalsRef, 'child_added', signalListener);

      remove(currentUserRef);
      
      if (isCurrentUserCreator) {
          onDisconnect(child(creatorRef, 'status')).cancel();
          set(child(creatorRef, 'status'), 'online');
      }
      
      peersRef.current.forEach(({ peer }) => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
      setPeers([]);
      peersRef.current = [];

      setTimeout(() => {
        get(usersRef).then((snapshot) => {
          if (!snapshot.exists()) {
            remove(roomRef);
            console.log(`[Room] Room ${roomID} was empty and has been deleted.`);
          }
        });
      }, 5000); 
    };
  // ✨ useEffect의 의존성 배열에 iceServersReady를 추가합니다.
  }, [roomID, user, localStream, createPeer, addPeer, iceServersReady]);
  
  return { peers };
}