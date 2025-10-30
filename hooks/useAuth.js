// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { ref, remove, get } from 'firebase/database';
import { doc, onSnapshot } from 'firebase/firestore'; // ✨ [수정]
import { auth, database, firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useAuth() {
  // ✨ [수정] setUserGender 추가
  const { setUser, setIsCreator, setIsAuthLoading, setFollowing, setUserGender } = useAppStore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (currentUser) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        
        const unsubscribeFirestore = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            setIsCreator(userData.isCreator || false);
            setFollowing(userData.following || []);
            setUserGender(userData.gender || null); // ✨ [추가]
          } else {
            setIsCreator(false);
            setFollowing([]);
            setUserGender(null); // ✨ [추가]
          }
        });

        // Return a cleanup function
        return () => {
          unsubscribeFirestore();
        };
      } else {
        // User is logged out
        setIsCreator(false);
        setFollowing([]);
        setUserGender(null); // ✨ [추가]
      }
    });

    return () => unsubscribeAuth();
  }, [setUser, setIsAuthLoading, setIsCreator, setFollowing, setUserGender]); // ✨ [수정] 의존성 배열

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
