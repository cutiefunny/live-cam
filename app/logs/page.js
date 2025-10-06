// app/logs/page.js
'use client';
import { useState, useEffect } from 'react';
import { ref, onValue, off, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import styles from './Logs.module.css';

export default function LogsPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [logs, setLogs] = useState([]);
  const [currentSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('log_session_id') || 'N/A';
    }
    return 'N/A';
  });

  // 모든 로그 세션 ID 목록을 가져옵니다.
  useEffect(() => {
    const sessionsRef = ref(database, 'logs');
    const listener = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val();
      const sessionIds = data ? Object.keys(data) : [];
      setSessions(sessionIds.reverse()); // 최신 세션이 위로 오도록
    });

    return () => off(sessionsRef, 'value', listener);
  }, []);

  // 선택된 세션의 로그를 실시간으로 가져옵니다.
  useEffect(() => {
    if (!selectedSession) {
      setLogs([]);
      return;
    }

    const logsRef = ref(database, `logs/${selectedSession}`);
    const listener = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedLogs = data ? Object.values(data) : [];
      setLogs(loadedLogs);
    });

    return () => off(logsRef, 'value', listener);
  }, [selectedSession]);

  const handleClearAllLogs = () => {
    if (window.confirm('Are you sure you want to delete ALL logs from the database?')) {
      const logsRef = ref(database, 'logs');
      remove(logsRef).then(() => {
        alert('All logs have been cleared.');
        setSessions([]);
        setSelectedSession('');
      });
    }
  };

  const copyToClipboard = () => {
    const logText = logs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText)
      .then(() => alert('Logs for this session copied to clipboard!'))
      .catch(err => console.error('Failed to copy logs: ', err));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Application Logs</h1>
      <p className={styles.currentSession}>Your Current Session ID: <strong>{currentSessionId}</strong></p>
      
      <div className={styles.actions}>
        <select 
          value={selectedSession} 
          onChange={(e) => setSelectedSession(e.target.value)}
          className={styles.sessionSelector}
        >
          <option value="">-- Select a Session --</option>
          {sessions.map(sessionId => (
            <option key={sessionId} value={sessionId}>
              {sessionId} {sessionId === currentSessionId ? '(This Session)' : ''}
            </option>
          ))}
        </select>
        <button onClick={copyToClipboard} className={styles.button} disabled={!selectedSession}>Copy</button>
        <button onClick={handleClearAllLogs} className={`${styles.button} ${styles.clearButton}`}>Clear All Logs</button>
      </div>

      <div className={styles.logContainer}>
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div key={index} className={`${styles.logEntry} ${styles[log.type]}`}>
              <span className={styles.timestamp}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={styles.type}>[{log.type.toUpperCase()}]</span>
              <pre className={styles.message}>{log.message}</pre>
            </div>
          ))
        ) : (
          <p>{selectedSession ? 'No logs for this session.' : 'Select a session to view logs.'}</p>
        )}
      </div>
    </div>
  );
}