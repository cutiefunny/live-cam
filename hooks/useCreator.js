// hooks/useCreator.js
'use client';
import { useState, useEffect } from 'react';
import { ref, onDisconnect, remove, onValue, get, set, off } from 'firebase/database';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database, storage, firestore } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';
import { nanoid } from 'nanoid';

export function useCreator() {
  const { user, isCreator: isUserRoleCreator } = useAppStore();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // 이 useEffect는 온라인 상태일 때의 로직만 처리합니다.
    if (!user || !isUserRoleCreator || !isOnline) {
      return;
    }

    const creatorRef = ref(database, `creators/${user.uid}`);
    const connectedRef = ref(database, '.info/connected');

    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // 비정상적인 연결 종료 시 RTDB에서 데이터를 삭제합니다.
        onDisconnect(creatorRef).remove();
        // 온라인 상태로 설정합니다.
        set(creatorRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          status: 'online',
        });
      }
    });

    // 컴포넌트 언마운트 또는 isOnline이 false가 될 때 실행되는 클린업 함수
    return () => {
      off(connectedRef, 'value', listener);
      // 안전장치로, 여기서도 데이터를 삭제합니다.
      remove(creatorRef);
    };
  }, [user, isUserRoleCreator, isOnline]);
  
  // 컴포넌트 마운트 시 초기 온라인 상태를 확인합니다.
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
  
  // ✨ [수정] goOffline 함수가 명시적으로 데이터를 삭제하도록 변경
  const goOffline = () => {
    if (user) {
      const creatorRef = ref(database, `creators/${user.uid}`);
      remove(creatorRef);
    }
    setIsOnline(false); // 로컬 상태도 업데이트
  };

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