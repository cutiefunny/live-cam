// components/room/VideoGrid.js
'use client';
import Video from '@/components/Video';
import styles from '@/app/room/[roomId]/Room.module.css';

export default function VideoGrid({ myStream, remoteStream, user, otherUser }) {
  return (
    <main className={styles.main}>
      {myStream && (
        <div className={styles.myVideoContainer}>
          <Video stream={myStream} muted={true} />
          <div className={styles.displayName}>{user.displayName} (You)</div>
        </div>
      )}
      
      {remoteStream && otherUser ? (
        <div className={styles.remoteVideoContainer}>
          <Video 
            stream={remoteStream} 
            photoURL={otherUser.photoURL} 
            displayName={otherUser.displayName} 
          />
        </div>
      ) : (
        <div className={styles.waitingMessage}>
          <h2>Waiting for other participant...</h2>
        </div>
      )}
    </main>
  );
}