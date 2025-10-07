// components/Toast.js
'use client';
import { useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import styles from './Toast.module.css';

const Toast = () => {
  const { toast, hideToast } = useAppStore();

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000); // 3초 후에 자동으로 사라집니다.

      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast.visible) return null;

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`}>
      {toast.message}
    </div>
  );
};

export default Toast;