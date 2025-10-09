// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { ref, remove, get } from 'firebase/database';
import { doc, onSnapshot } from 'firebase/firestore'; // ✨ [추가]
import { auth, database, firestore } from '@/lib/firebase'; // ✨ [수정]
import useAppStore from '@/store/useAppStore';

export function useAuth() {
  const { setUser, setIsCreator, setIsAuthLoading, setFollowing } = useAppStore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (currentUser) {
        // ✨ [수정 시작] Firestore에서 사용자 데이터 실시간 구독
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        
        const unsubscribeFirestore = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            setIsCreator(userData.isCreator || false);
            setFollowing(userData.following || []);
          } else {
            setIsCreator(false);
            setFollowing([]);
          }
        });

        // Return a cleanup function
        return () => {
          unsubscribeFirestore();
        };
        // ✨ [수정 끝]
      } else {
        // User is logged out
        setIsCreator(false);
        setFollowing([]);
      }
    });

    return () => unsubscribeAuth();
  }, [setUser, setIsAuthLoading, setIsCreator, setFollowing]);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  const signOut = async () => {
    const user = auth.currentUser;
    if (user) {
      // 실시간 상태 관리는 RealtimeDB 유지
      const creatorRef = ref(database, `creators/${user.uid}`);
      const snapshot = await get(creatorRef);
      if (snapshot.exists()) {
        await remove(creatorRef);
      }
    }
    await firebaseSignOut(auth);
  };

  return { signIn, signOut };
}