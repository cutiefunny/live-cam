// hooks/useRoom.js
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildRemoved, set, remove, onDisconnect, get, child, off } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoom(roomID, user, localStream, createPeer, addPeer) {
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (!user || !roomID || localStream === undefined) {
      return;
    }

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
            // 비정상 종료 시 오프라인으로 처리
            onDisconnect(child(creatorRef, 'status')).set('offline');
        }
    });

    const handleUserJoined = (snapshot) => {
      const otherUserId = snapshot.key;
      const userData = snapshot.val();
      if (otherUserId === user.uid) return;

      if (user.uid > otherUserId) {
        setPeers(currentPeers => {
          if (currentPeers.some(p => p.peerID === otherUserId)) {
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
      if (senderId === user.uid) {
        remove(snapshot.ref);
        return;
      };

      const peerToSignal = peersRef.current.find(p => p.peerID === senderId);

      if (peerToSignal) {
        if (peerToSignal.peer && !peerToSignal.peer.destroyed) {
          peerToSignal.peer.signal(signal);
        }
      } else {
        if (signal.type === 'offer' && user.uid < senderId) {
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
      const peerToRemove = peersRef.current.find(p => p.peerID === removedUserId);
      
      if (peerToRemove && peerToRemove.peer && !peerToRemove.peer.destroyed) {
          peerToRemove.peer.destroy();
      }

      setPeers(currentPeers => currentPeers.filter(p => p.peerID !== removedUserId));
    };
    
    set(currentUserRef, { photoURL: user.photoURL, displayName: user.displayName });
    onDisconnect(currentUserRef).remove();
    
    const userJoinedListener = onChildAdded(usersRef, handleUserJoined);
    const userLeftListener = onChildRemoved(usersRef, handleUserLeft);
    const signalListener = onChildAdded(signalsRef, handleSignal);

    return () => {
      off(usersRef, 'child_added', userJoinedListener);
      off(usersRef, 'child_removed', userLeftListener);
      off(signalsRef, 'child_added', signalListener);

      remove(currentUserRef);
      
      if (isCurrentUserCreator) {
          // 방을 나갈 때 설정했던 onDisconnect는 취소하고,
          onDisconnect(child(creatorRef, 'status')).cancel();
          // 다시 'online' 상태로 되돌립니다.
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
            console.log(`Room ${roomID} was empty and has been deleted.`);
          }
        });
      }, 5000); 
    };
  }, [roomID, user, localStream, createPeer, addPeer]);
  
  return { peers };
}