// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { ref, set, onValue, off, onDisconnect, get, remove } from 'firebase/database';
import { auth, database } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      if (!currentUser) {
        setIsCreator(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 사용자의 크리에이터 역할(isCreator) 상태를 실시간으로 감지합니다.
  useEffect(() => {
    if (!user) return;

    const userRef = ref(database, `users/${user.uid}`);
    const listener = onValue(userRef, (snapshot) => {
      const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
      setIsCreator(isUserCreator);
    });

    return () => off(userRef, 'value', listener);
  }, [user]);


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
        await remove(creatorRef); // 온라인 크리에이터 목록에서 제거
    }
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsCreator(false);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };
  
  // ✨ [수정] 'goLive' -> 'goOnline'으로 이름 변경 및 로직 수정
  const goOnline = async () => {
    if (!user || !isCreator) return; // 크리에이터 역할이 있는 사용자만 온라인 가능
    const creatorRef = ref(database, `creators/${user.uid}`);
    await set(creatorRef, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        status: 'online',
    });
    // 연결이 끊기면 자동으로 오프라인(목록에서 제거)
    onDisconnect(creatorRef).remove();
  };

  const goOffline = async () => {
      if (!user) return;
      const creatorRef = ref(database, `creators/${user.uid}`);
      await remove(creatorRef);
  }

  return { user, isLoading, isCreator, signIn, signOut, goOnline, goOffline };
}