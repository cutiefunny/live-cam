// hooks/useCreator.js
import { ref, set, onDisconnect, remove, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';
import { nanoid } from 'nanoid';

export function useCreator() {
  const { user } = useAppStore();

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

  return { goOnline, goOffline, uploadCreatorPhotos, deleteCreatorPhoto, updateCreatorPhotoOrder };
}