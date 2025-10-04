// app/page.js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useAuth } from '@/hooks/useAuth';
import styles from './Home.module.css'; // CSS 모듈 import

export default function Home() {
  const { user, signIn, isLoading } = useAuth();
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const createAndJoin = () => {
    const newRoomId = nanoid(7);
    router.push(`/room/${newRoomId}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId) {
      router.push(`/room/${roomId}`);
    }
  };
  
  if (isLoading) {
    return <div className={styles.main}><div>Loading...</div></div>;
  }

  if (!user) {
    return (
      <main className={styles.main}>
        <div className={styles.loginContainer}>
            <h1 className={styles.loginTitle}>취향캠톡</h1>
            <p className={styles.loginDescription}>관심사 기반 영상 채팅을 시작해보세요.</p>
            <button onClick={signIn} className={styles.loginButton}>
                Google 계정으로 시작하기
            </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
        <div className={styles.lobbyContainer}>
            <h1 className={styles.lobbyTitle}>영상 채팅 방 참여하기</h1>
            <button onClick={createAndJoin} className={styles.createButton}>
                새로운 방 만들기
            </button>
            <div className={styles.divider}>
                <hr /><span >또는</span><hr />
            </div>
            <form onSubmit={joinRoom} className={styles.joinForm}>
                <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="방 ID 입력"
                    className={styles.joinInput}
                />
                <button type="submit" disabled={!roomId} className={styles.joinButton}>
                    참여
                </button>
            </form>
        </div>
    </main>
  );
}