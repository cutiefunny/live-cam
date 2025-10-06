// lib/logger.js
import { ref, push } from 'firebase/database';
import { database } from '@/lib/firebase';
import { nanoid } from 'nanoid';

let sessionId = null;

const initializeLogger = () => {
  if (typeof window === 'undefined') return;

  // 세션이 유지되는 동안 sessionId를 한 번만 생성합니다.
  if (!sessionId) {
    sessionId = nanoid(8);
    sessionStorage.setItem('log_session_id', sessionId);
  }

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const logToFirebase = (type, args) => {
    // sessionId가 없으면 로그를 전송하지 않습니다.
    if (!sessionId) return;
    
    const logRef = ref(database, `logs/${sessionId}`);
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      try {
        // 객체나 배열은 JSON 문자열로 변환합니다.
        if (typeof arg === 'object' && arg !== null) {
          // Error 객체는 스택 정보를 포함하여 별도 처리
          if (arg instanceof Error) {
            return JSON.stringify({ name: arg.name, message: arg.message, stack: arg.stack }, null, 2);
          }
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      } catch (e) {
        return 'Unserializable object';
      }
    }).join(' ');

    // Firebase에 로그 푸시
    push(logRef, {
      timestamp,
      type,
      message,
    });
  };

  console.log = function(...args) {
    originalConsole.log(...args);
    logToFirebase('log', args);
  };

  console.warn = function(...args) {
    originalConsole.warn(...args);
    logToFirebase('warn', args);
  };

  console.error = function(...args) {
    originalConsole.error(...args);
    logToFirebase('error', args);
  };
};

export default initializeLogger;