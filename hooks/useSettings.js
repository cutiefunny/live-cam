// hooks/useSettings.js
import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

const defaultSettings = {
  costToStart: 5, 
  costPerMinute: 1,
  creatorShareRate: 50,
};

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const settingsRef = ref(database, 'settings');
    const listener = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.val());
      } else {
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    });

    return () => off(settingsRef, 'value', listener);
  }, []);

  return { settings, isLoading };
}
