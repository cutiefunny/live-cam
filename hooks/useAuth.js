// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { ref, set, onValue, off, onDisconnect, get, remove, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
          setIsCreator(isUserCreator);
        }, { onlyOnce: true });
      } else {
        setIsCreator(false);
      }
    });
    return () => unsubscribeAuth();
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
      // 1. 새 아바타 파일이 있으면 업로드
      if (newAvatarFile) {
        // 이미지 처리 (리사이즈 & 압축)
        const processedImageBlob = await processImageForUpload(newAvatarFile, 150);
        
        // Firebase Storage에 업로드
        const avatarRef = storageRef(storage, `avatars/${user.uid}.avif`);
        const snapshot = await uploadBytes(avatarRef, processedImageBlob);
        newPhotoURL = await getDownloadURL(snapshot.ref);
      }

      // 2. Firebase Auth 프로필 업데이트
      await updateProfile(auth.currentUser, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

      // 3. Realtime Database 업데이트
      const updates = {};
      updates[`/users/${user.uid}/displayName`] = newDisplayName;
      updates[`/users/${user.uid}/photoURL`] = newPhotoURL;
      
      const creatorSnapshot = await get(ref(database, `creators/${user.uid}`));
      if (creatorSnapshot.exists()) {
        updates[`/creators/${user.uid}/displayName`] = newDisplayName;
        updates[`/creators/${user.uid}/photoURL`] = newPhotoURL;
      }
      
      await update(ref(database), updates);

      // 4. 로컬 상태 업데이트
      setUser({ ...user, displayName: newDisplayName, photoURL: newPhotoURL });
      
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error; // 에러를 호출한 곳으로 다시 던져서 UI 처리를 할 수 있게 함
    }
  };


  return { user, isLoading, isCreator, signIn, signOut, goOnline, goOffline, updateUserProfile };
}