// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { ref, onValue, off, remove } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useAuth() {
  const { setUser, setIsCreator, setIsAuthLoading, setFollowing } = useAppStore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const followingRef = ref(database, `users/${currentUser.uid}/following`);

        const userListener = onValue(userRef, (snapshot) => {
          const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
          setIsCreator(isUserCreator);
        });

        const followingListener = onValue(followingRef, (snapshot) => {
            const followingData = snapshot.val() || {};
            setFollowing(Object.keys(followingData));
        });

        // Return a cleanup function for when the user logs out or component unmounts
        return () => {
          off(userRef, 'value', userListener);
          off(followingRef, 'value', followingListener);
        };
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
      // Go offline if the user is a creator
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