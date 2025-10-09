// hooks/useCreator.js
'use client'; // ✨ [추가] 이 파일을 클라이언트 컴포넌트로 선언합니다.
import { useState, useEffect } from 'react';
import { ref, onDisconnect, remove, onValue, get, set } from 'firebase/database';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database, storage, firestore } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';
import { nanoid } from 'nanoid';

export function useCreator() {
  const { user, isCreator: isUserRoleCreator } = useAppStore();
  const [isOnline, setIsOnline] = useState(false);

  // 실시간 온라인 상태 관리는 RealtimeDB 유지 (기존과 동일)
  useEffect(() => {
    if (!user || !isUserRoleCreator || !isOnline) {
      if (user) {
        remove(ref(database, `creators/${user.uid}`));
      }
      return;
    }

    const creatorRef = ref(database, `creators/${user.uid}`);
    const connectedRef = ref(database, '.info/connected');

    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(creatorRef).remove();
        set(creatorRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          status: 'online',
        });
      }
    });

    return () => {
      off(connectedRef, 'value', listener);
      remove(creatorRef);
    };
  }, [user, isUserRoleCreator, isOnline]);
  
  useEffect(() => {
    if (user && isUserRoleCreator) {
      const creatorRef = ref(database, `creators/${user.uid}`);
      get(creatorRef).then(snapshot => {
        if (snapshot.exists()) {
          setIsOnline(true);
        }
      });
    }
  }, [user, isUserRoleCreator]);

  const goOnline = () => setIsOnline(true);
  const goOffline = () => setIsOnline(false);

  const uploadCreatorPhotos = async (files) => {
    if (!user) throw new Error("User not logged in");

    const uploadPromises = files.map(async (file) => {
      const photoId = nanoid(10);
      const imageRef = storageRef(storage, `creator_photos/${user.uid}/${photoId}`);
      const processedImage = await processImageForUpload(file, 800);
      const snapshot = await uploadBytes(imageRef, processedImage);
      const url = await getDownloadURL(snapshot.ref);
      return { id: photoId, url };
    });

    const newPhotos = await Promise.all(uploadPromises);

    const profileDocRef = doc(firestore, 'creator_profiles', user.uid);
    const profileDoc = await getDoc(profileDocRef);
    const existingPhotos = profileDoc.data()?.photos || [];
    
    const updatedPhotos = [...existingPhotos, ...newPhotos].map((photo, index) => ({ ...photo, order: index }));

    await setDoc(profileDocRef, { photos: updatedPhotos }, { merge: true });
  };

  const deleteCreatorPhoto = async (photoId) => {
    if (!user || !photoId) throw new Error("Invalid arguments");
    
    const profileDocRef = doc(firestore, 'creator_profiles', user.uid);
    const profileDoc = await getDoc(profileDocRef);
    const existingPhotos = profileDoc.data()?.photos || [];

    const photoToDelete = existingPhotos.find(p => p.id === photoId);
    
    if (photoToDelete) {
      const imageRef = storageRef(storage, `creator_photos/${user.uid}/${photoId}`);
      try {
        await deleteObject(imageRef);
      } catch (error) {
        if (error.code !== 'storage/object-not-found') throw error;
      }

      const newPhotos = existingPhotos
        .filter(p => p.id !== photoId)
        .map((photo, index) => ({ ...photo, order: index }));

      await updateDoc(profileDocRef, { photos: newPhotos });
    }
  };

  const updateCreatorPhotoOrder = async (photos) => {
    if (!user) throw new Error("User not logged in");

    const photosToSave = photos.map((photo, index) => ({ ...photo, order: index }));

    const profileDocRef = doc(firestore, 'creator_profiles', user.uid);
    await updateDoc(profileDocRef, { photos: photosToSave });
  };

  return { isOnline, goOnline, goOffline, uploadCreatorPhotos, deleteCreatorPhoto, updateCreatorPhotoOrder };
}