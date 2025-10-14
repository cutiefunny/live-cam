// hooks/useRoomEvents.js
import { useState, useEffect } from 'react';
import { ref, onChildAdded, onChildRemoved, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useRoomEvents(roomId) {
  const [participants, setParticipants] = useState([]);
  const { setGiftAnimation, showToast, user } = useAppStore();

  useEffect(() => {
    if (!roomId) return;

    const usersRef = ref(database, `rooms/${roomId}/users`);
    const giftsRef = ref(database, `rooms/${roomId}/gifts`);

    const handleUserJoined = (snapshot) => {
      const userData = snapshot.val();
      setParticipants((prev) => [...prev, { uid: snapshot.key, ...userData }]);
    };

    const handleUserLeft = (snapshot) => {
      setParticipants((prev) => prev.filter((p) => p.uid !== snapshot.key));
    };

    const handleGift = (snapshot) => {
      const giftData = snapshot.val();
      setGiftAnimation(giftData);

      if (user && giftData.senderId !== user.uid) {
        showToast(`${giftData.senderName}님에게 ${giftData.name} 선물을 받았습니다!`, 'success');
      }
      // 선물을 처리한 후 DB에서 삭제
      snapshot.ref.remove();
    };

    const userJoinedListener = onChildAdded(usersRef, handleUserJoined);
    const userLeftListener = onChildRemoved(usersRef, handleUserLeft);
    const giftListener = onChildAdded(giftsRef, handleGift);

    return () => {
      off(usersRef, 'child_added', userJoinedListener);
      off(usersRef, 'child_removed', userLeftListener);
      off(giftsRef, 'child_added', giftListener);
    };
  }, [roomId, setGiftAnimation, showToast, user]);

  return { participants };
}