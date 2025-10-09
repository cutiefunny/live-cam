// hooks/useCreator.js
import { useState, useEffect } from 'react';
import { ref, set, onDisconnect, remove, onValue, off, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';
import { nanoid } from 'nanoid';

export function useCreator() {
  const { user, isCreator: isUserRoleCreator } = useAppStore();
  const [isOnline, setIsOnline] = useState(false);

  // isOnline 상태에 따라 온라인 상태를 Firebase와 동기화하는 useEffect
  useEffect(() => {
    // 사용자가 없거나, 크리에이터가 아니거나, 온라인 상태가 아니면 실행하지 않음
    if (!user || !isUserRoleCreator || !isOnline) {
      if (user) {
        // 오프라인 상태가 되면 확실하게 데이터를 삭제
        remove(ref(database, `creators/${user.uid}`));
      }
      return;
    }

    const creatorRef = ref(database, `creators/${user.uid}`);
    const connectedRef = ref(database, '.info/connected');

    const listener = onValue(connectedRef, (snap) => {
      // Firebase 서버와의 연결 상태가 true일 때
      if (snap.val() === true) {
        // 연결이 끊어지면 creators 경로에서 자신의 데이터를 삭제하도록 예약
        onDisconnect(creatorRef).remove();
        
        // 온라인 상태로 설정
        set(creatorRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          status: 'online',
        });
      }
    });

    // 컴포넌트가 언마운트되거나, 의존성이 변경될 때 실행될 클린업 함수
    return () => {
      off(connectedRef, 'value', listener); // 연결 상태 리스너 제거
      remove(creatorRef); // 확실하게 오프라인 처리
    };
  }, [user, isUserRoleCreator, isOnline]);
  
  // 페이지 로드 시, 이미 온라인 상태였는지 확인하여 UI 상태 동기화
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

    const photoRef = ref(database, `creator_profiles/${user.uid}/photos`);
    const existingPhotosSnapshot = await get(photoRef);
    const existingPhotosData = existingPhotosSnapshot.val();
    
    let currentPhotos = Array.isArray(existingPhotosData) ? existingPhotosData : (existingPhotosData ? Object.values(existingPhotosData) : []);

    newPhotos.forEach((photo) => {
        currentPhotos.push(photo);
    });

    const photosToSave = currentPhotos.map((photo, index) => ({ ...photo, order: index }));

    await set(photoRef, photosToSave);
  };

  const deleteCreatorPhoto = async (photoId) => {
    if (!user) throw new Error("User not logged in");
    if (!photoId) {
      console.error("Delete failed: photoId is undefined.");
      return;
    }
    
    const photosRef = ref(database, `creator_profiles/${user.uid}/photos`);
    const snapshot = await get(photosRef);
    const existingPhotosData = snapshot.val();
    
    let currentPhotos = Array.isArray(existingPhotosData) ? existingPhotosData : (existingPhotosData ? Object.values(existingPhotosData) : []);
    
    const photoToDelete = currentPhotos.find(p => p.id === photoId);
    
    if (photoToDelete) {
      const imageRef = storageRef(storage, `creator_photos/${user.uid}/${photoId}`);
      try {
        await deleteObject(imageRef);
      } catch (error) {
        if (error.code === 'storage/object-not-found') {
          console.log("Storage object not found, but proceeding to delete from database.");
        } else {
          throw error;
        }
      }

      let newPhotos = currentPhotos.filter(p => p.id !== photoId);
      newPhotos = newPhotos.map((photo, index) => ({ ...photo, order: index }));

      await set(photosRef, newPhotos);
    }
  };

  const updateCreatorPhotoOrder = async (photos) => {
    if (!user) throw new Error("User not logged in");

    const photosToSave = photos.map((photo, index) => ({
      ...photo,
      order: index
    }));

    const photosRef = ref(database, `creator_profiles/${user.uid}/photos`);
    await set(photosRef, photosToSave);
  };

  return { isOnline, goOnline, goOffline, uploadCreatorPhotos, deleteCreatorPhoto, updateCreatorPhotoOrder };
}