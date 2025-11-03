// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { ref, remove, get } from 'firebase/database';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, database, firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useAuth() {
  // ✨ [수정] setApplicationStatus 추가
  const { setUser, setIsCreator, setIsAuthLoading, setFollowing, setUserGender, setApplicationStatus } = useAppStore();

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
            setUserGender(userData.gender || null);
            setApplicationStatus(userData.applicationStatus || null); // ✨ [추가]
          } else {
            // Firestore에 유저 문서가 없는 경우
            setIsCreator(false);
            setFollowing([]);
            setUserGender(null);
            setApplicationStatus(null); // ✨ [추가]
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
        setUserGender(null);
        setApplicationStatus(null); // ✨ [추가]
      }
    });

    return () => unsubscribeAuth();
    // ✨ [수정] 의존성 배열에 setApplicationStatus 추가
  }, [setUser, setIsAuthLoading, setIsCreator, setFollowing, setUserGender, setApplicationStatus]);

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