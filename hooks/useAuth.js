// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { ref, set, onDisconnect, get, remove } from 'firebase/database';
import { auth, database } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // 사용자가 로그인하면, 크리에이터DB에 존재하는지 확인하여 isCreator 상태만 설정합니다.
        const creatorRef = ref(database, `creators/${currentUser.uid}`);
        get(creatorRef).then((snapshot) => {
          if (snapshot.exists()) {
            // isCreator 상태만 true로 설정하고, 자동으로 online으로 변경하지 않습니다.
            setIsCreator(true);
          } else {
            setIsCreator(false);
          }
        });
      } else {
        // 로그아웃 시 isCreator 상태를 false로 초기화합니다.
        setIsCreator(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  const signOut = async () => {
    if (user) {
        const creatorRef = ref(database, `creators/${user.uid}`);
        const snapshot = await get(creatorRef);
        // 로그아웃 전, 크리에이터이고 'online' 또는 'busy' 상태였다면 'offline'으로 변경합니다.
        if (snapshot.exists()) {
            await set(ref(database, `creators/${user.uid}/status`), 'offline');
        }
    }
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsCreator(false); // 로그아웃 시 isCreator 상태 확실히 초기화
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };
  
  const goLive = async () => {
    if (!user) return;
    const creatorRef = ref(database, `creators/${user.uid}`);
    await set(creatorRef, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        status: 'online', // 'online', 'offline', 'busy'
    });
    // 연결이 끊기면 오프라인으로 상태를 변경하도록 설정합니다.
    onDisconnect(ref(database, `creators/${user.uid}/status`)).set('offline');
    setIsCreator(true);
  };

  const goOffline = async () => {
      if (!user) return;
      const creatorRef = ref(database, `creators/${user.uid}`);
      // 크리에이터 목록에서 자신을 제거합니다.
      await remove(creatorRef);
      setIsCreator(false);
  }

  return { user, isLoading, isCreator, signIn, signOut, goLive, goOffline };
}