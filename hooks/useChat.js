// hooks/useChat.js
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

// 두 사용자 간의 일관된 채팅방 ID를 생성하는 헬퍼 함수
export const getChatRoomId = (uid1, uid2) => {
  return uid1 > uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

// 채팅 목록을 관리하는 훅
export function useChatList() {
  const { user } = useAppStore();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    };

    const chatsRef = collection(firestore, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // ✨ [수정] 변수 이름을 'doc'에서 'chatDoc'으로 변경하여 이름 충돌을 해결합니다.
      const chatList = snapshot.docs.map(async (chatDoc) => {
        const chatData = chatDoc.data();
        const otherParticipantId = chatData.participants.find(id => id !== user.uid);
        
        // firestore에서 가져온 doc 함수를 정상적으로 사용합니다.
        const userDoc = await getDoc(doc(firestore, 'users', otherParticipantId));
        const otherUserInfo = userDoc.data();
        
        return {
          id: chatDoc.id,
          ...chatData,
          otherUser: {
            uid: otherParticipantId,
            displayName: otherUserInfo?.displayName || 'Unknown User',
            photoURL: otherUserInfo?.photoURL || '/images/icon.png',
          }
        };
      });
      Promise.all(chatList).then(completedChats => {
        setChats(completedChats);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [user]);

  return { chats, loading };
}

// 특정 채팅방의 메시지를 위한 훅
export function useChatMessages(chatId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) {
        setLoading(false);
        return;
    };

    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messageList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  return { messages, loading };
}

// 메시지 전송 함수
export async function sendMessage(chatId, text, sender, receiverId) {
  if (!text.trim() || !sender) return;

  const chatRef = doc(firestore, 'chats', chatId);
  const messagesRef = collection(chatRef, 'messages');

  // 하위 컬렉션에 메시지 추가
  await addDoc(messagesRef, {
    senderId: sender.uid,
    text: text,
    timestamp: serverTimestamp(),
  });

  // 상위 채팅 문서에 마지막 메시지 업데이트
  await setDoc(chatRef, {
    participants: [sender.uid, receiverId],
    lastMessage: text,
    lastMessageTimestamp: serverTimestamp(),
  }, { merge: true });
}