// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { ref, set, onValue, off, onDisconnect, get, remove, update, runTransaction, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  // ✨ [수정] Firebase 인증 상태 리스너와 DB 리스너 로직 분리
  useEffect(() => {
    // 1. 인증 상태 변경 감지
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    // 인증 리스너 정리
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // 2. 사용자 객체가 있을 때만 DB에서 역할 정보 감지
    if (!user) {
      setIsCreator(false);
      return; // 사용자가 없으면 아무것도 안 함
    }

    const userRef = ref(database, `users/${user.uid}`);
    // 역할 정보 리스너 등록
    const unsubscribeDB = onValue(userRef, (snapshot) => {
      const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
      setIsCreator(isUserCreator);
    });

    // 사용자가 바뀌거나 컴포넌트가 언마운트될 때 DB 리스너 정리
    return () => unsubscribeDB();
  }, [user]); // user 객체가 변경될 때마다 이 useEffect가 실행됨

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
    setUser(null);
    setIsCreator(false);
  };
  
  const goOnline = async () => {
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

  return { user, isLoading, isCreator, signIn, signOut, goOnline, goOffline, updateUserProfile, requestCoinCharge };
}