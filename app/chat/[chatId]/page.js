// app/chat/[chatId]/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';
import { useChatMessages, sendMessage, getChatRoomId } from '@/hooks/useChat';
import Image from 'next/image';
import styles from './Chat.module.css';

export default function ChatPage() {
  const router = useRouter();
  const { chatId: otherUserId } = useParams();
  const { user } = useAppStore();
  const [otherUser, setOtherUser] = useState(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const chatId = user ? getChatRoomId(user.uid, otherUserId) : null;
  const { messages, loading } = useChatMessages(chatId);

  useEffect(() => {
    const fetchOtherUser = async () => {
      if (!otherUserId) return;
      const userDoc = await getDoc(doc(firestore, 'users', otherUserId));
      if (userDoc.exists()) {
        setOtherUser({ uid: userDoc.id, ...userDoc.data() });
      }
    };
    fetchOtherUser();
  }, [otherUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatId && user && otherUserId) {
      sendMessage(chatId, message, user, otherUserId);
      setMessage('');
    }
  };

  if (!user || !otherUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>&larr;</button>
        <Image
          src={otherUser.photoURL || '/images/icon.png'}
          alt={otherUser.displayName}
          width={40}
          height={40}
          className={styles.avatar}
        />
        <h2>{otherUser.displayName}</h2>
      </header>
      <div className={styles.messageList}>
        {loading ? (
            <p>Loading messages...</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${
                msg.senderId === user.uid ? styles.sent : styles.received
              }`}
            >
              <p>{msg.text}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className={styles.inputForm} onSubmit={handleSendMessage}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className={styles.input}
        />
        <button type="submit" className={styles.sendButton}>전송</button>
      </form>
    </div>
  );
}