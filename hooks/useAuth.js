// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { ref, set, onValue, off, onDisconnect, get, remove, update, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';

export function useAuth() {
  const { user, setUser, setIsCreator, setIsAuthLoading } = useAppStore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [setUser, setIsAuthLoading]);

  useEffect(() => {
    if (!user) {
      setIsCreator(false);
      return;
    }

    const userRef = ref(database, `users/${user.uid}`);
    const unsubscribeDB = onValue(userRef, (snapshot) => {
      const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
      setIsCreator(isUserCreator);
    });

    return () => unsubscribeDB();
  }, [user, setIsCreator]);

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
      await remove(ref(database, `creators/${user.uid}`));
    }
    await firebaseSignOut(auth);
    // Zustand 상태는 onAuthStateChanged 리스너가 null로 설정합니다.
  };
  
  const goOnline = async () => {
    const { isCreator } = useAppStore.getState();
    if (!user || !isCreator) return;

    const creatorRef = ref(database, `creators/${user.uid}`);
    await set(creatorRef, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        status: 'online',
    });
    onDisconnect(creatorRef).remove();
  };

  const goOffline = async () => {
      if (!user) return;
      await remove(ref(database, `creators/${user.uid}`));
  };

  const updateUserProfile = async (newDisplayName, newAvatarFile) => {
    if (!user) return;

    let newPhotoURL = user.photoURL;

    try {
      if (newAvatarFile) {
        const processedImageBlob = await processImageForUpload(newAvatarFile, 150);
        const avatarRef = storageRef(storage, `avatars/${user.uid}.avif`);
        const snapshot = await uploadBytes(avatarRef, processedImageBlob);
        newPhotoURL = await getDownloadURL(snapshot.ref);
      }

      await updateProfile(auth.currentUser, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

      const updates = {};
      updates[`/users/${user.uid}/displayName`] = newDisplayName;
      updates[`/users/${user.uid}/photoURL`] = newPhotoURL;
      
      const creatorSnapshot = await get(ref(database, `creators/${user.uid}`));
      if (creatorSnapshot.exists()) {
        updates[`/creators/${user.uid}/displayName`] = newDisplayName;
        updates[`/creators/${user.uid}/photoURL`] = newPhotoURL;
      }
      
      await update(ref(database), updates);
      
      // onAuthStateChanged가 변경을 감지하고 전역 상태를 업데이트합니다.
      // 즉시 UI 업데이트를 위해 수동으로 상태를 업데이트 할 수도 있습니다.
      setUser({ ...user, displayName: newDisplayName, photoURL: newPhotoURL });
      
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const requestCoinCharge = async (amount, price) => {
    if (!user) throw new Error("User not logged in");

    const requestsRef = ref(database, 'charge_requests');
    const newRequestRef = push(requestsRef);
    
    await set(newRequestRef, {
      requestId: newRequestRef.key,
      userId: user.uid,
      userName: user.displayName,
      userEmail: user.email,
      amount: amount,
      price: price,
      timestamp: Date.now(),
      status: 'pending', // 'pending', 'approved', 'rejected'
    });
  };

  // useAuth 훅은 이제 상태 대신 액션 함수들을 주로 반환합니다.
  // 상태는 useAppStore를 통해 컴포넌트에서 직접 구독합니다.
  return { signIn, signOut, goOnline, goOffline, updateUserProfile, requestCoinCharge };
}