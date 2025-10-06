// app/logs/page.js
'use client';
import useAppStore from '@/store/useAppStore';
import styles from './Logs.module.css';

export default function LogsPage() {
  const { logs, clearLogs } = useAppStore();

  const copyToClipboard = () => {
    const logText = logs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText)
      .then(() => alert('Logs copied to clipboard!'))
      .catch(err => console.error('Failed to copy logs: ', err));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Application Logs</h1>
      <div className={styles.actions}>
        <button onClick={copyToClipboard} className={styles.button}>Copy Logs</button>
        <button onClick={clearLogs} className={`${styles.button} ${styles.clearButton}`}>Clear Logs</button>
      </div>
      <div className={styles.logContainer}>
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div key={index} className={`${styles.logEntry} ${styles[log.type]}`}>
              <span className={styles.timestamp}>{log.timestamp}</span>
              <span className={styles.type}>[{log.type.toUpperCase()}]</span>
              <pre className={styles.message}>{log.message}</pre>
            </div>
          ))
        ) : (
          <p>No logs recorded yet.</p>
        )}
      </div>
    </div>
  );
}