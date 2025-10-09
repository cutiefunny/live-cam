// hooks/useSettings.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore'; // ✨ [추가]
import { firestore } from '@/lib/firebase'; // ✨ [수정]

const defaultSettings = {
  costToStart: 5, 
  costPerMinute: 1,
  creatorShareRate: 50,
};

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✨ [수정 시작] Firestore 'settings' 문서 구독
    const settingsDocRef = doc(firestore, 'settings', 'live');
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      } else {
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
    // ✨ [수정 끝]
  }, []);

  return { settings, isLoading };
}