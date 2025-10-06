// lib/logger.js
import useAppStore from '@/store/useAppStore';

const initializeLogger = () => {
  if (typeof window === 'undefined') return;

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const logToStore = (type, args) => {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      try {
        if (typeof arg === 'object' && arg !== null) {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      } catch (e) {
        return 'Unserializable object';
      }
    }).join(' ');

    useAppStore.getState().addLog({
      timestamp,
      type,
      message,
    });
  };

  console.log = function(...args) {
    originalConsole.log(...args);
    logToStore('log', args);
  };

  console.warn = function(...args) {
    originalConsole.warn(...args);
    logToStore('warn', args);
  };

  console.error = function(...args) {
    originalConsole.error(...args);
    logToStore('error', args);
  };
};

export default initializeLogger;