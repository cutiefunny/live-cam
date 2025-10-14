// hooks/useRoomPresence.js
import { useEffect } from 'react';
import { ref, set, remove, onDisconnect } from 'firebase/database';
import { database } from '@/lib/firebase';

export function useRoomPresence(roomId, user, isCreator) {
  useEffect(() => {
    if (!roomId || !user) return;

    const roomRef = ref(database, `rooms/${roomId}`);
    const currentUserRef = ref(database, `rooms/${roomId}/users/${user.uid}`);
    const creatorStatusRef = isCreator ? ref(database, `creators/${user.uid}/status`) : null;

    // 사용자를 방에 추가하고, 연결이 끊어지면 자동으로 제거되도록 설정
    set(currentUserRef, {
      photoURL: user.photoURL,
      displayName: user.displayName,
      email: user.email,
    });
    onDisconnect(currentUserRef).remove();
    onDisconnect(roomRef).remove(); // 방에 아무도 없으면 방 자동 삭제 (선택적)

    // 크리에이터인 경우 상태를 'busy'로 변경하고, 연결 끊어지면 'online'으로 복구
    if (isCreator && creatorStatusRef) {
      set(creatorStatusRef, 'busy');
      onDisconnect(creatorStatusRef).set('online');
    }

    return () => {
      // 컴포넌트 언마운트 시 즉시 정리
      remove(currentUserRef);
      if (isCreator && creatorStatusRef) {
        onDisconnect(creatorStatusRef).cancel(); // 연결 끊김 시의 동작 취소
        set(creatorStatusRef, 'online'); // 직접 'online'으로 상태 변경
      }
    };
  }, [roomId, user, isCreator]);
}