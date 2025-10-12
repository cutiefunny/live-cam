// app/chat/page.js
'use client';
import Link from 'next/link';
import { useChatList } from '@/hooks/useChat';
import useAppStore from '@/store/useAppStore';
import Image from 'next/image';
import styles from './ChatList.module.css';

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 24시간 미만
    if (diff < 86400000) {
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    // 7일 미만
    if (diff < 604800000) {
        return date.toLocaleDateString('ko-KR', { weekday: 'short' });
    }
    return date.toLocaleDateString('ko-KR');
}


export default function ChatListPage() {
  const { user } = useAppStore();
  const { chats, loading } = useChatList();

  if (loading) {
    return <div className={styles.loading}>채팅 목록을 불러오는 중...</div>;
  }

  if (!user) {
    return <div className={styles.loading}>로그인이 필요합니다.</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>채팅</h1>
      </header>
      <main className={styles.main}>
        {chats.length === 0 ? (
          <p className={styles.noChats}>채팅 기록이 없습니다.</p>
        ) : (
          <div className={styles.chatList}>
            {chats.map((chat) => (
              <Link href={`/chat/${chat.otherUser.uid}`} key={chat.id} className={styles.chatItemLink}>
                <div className={styles.chatItem}>
                  <Image
                    src={chat.otherUser.photoURL}
                    alt={chat.otherUser.displayName}
                    width={50}
                    height={50}
                    className={styles.avatar}
                  />
                  <div className={styles.chatInfo}>
                    <div className={styles.chatHeader}>
                      <span className={styles.displayName}>{chat.otherUser.displayName}</span>
                      <span className={styles.timestamp}>{formatTimestamp(chat.lastMessageTimestamp)}</span>
                    </div>
                    <p className={styles.lastMessage}>{chat.lastMessage}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}