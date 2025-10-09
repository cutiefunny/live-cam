// hooks/useUserProfile.js
import { updateProfile } from "firebase/auth";
import { ref, update, get, remove, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';

export function useUserProfile() {
  const { user, setUser, showToast } = useAppStore();

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
  
  const toggleFollowCreator = async (creatorId) => {
    if (!user) {
        showToast('로그인이 필요합니다.', 'error');
        return;
    }
    if (user.uid === creatorId) return;

    const currentUserFollowingRef = ref(database, `users/${user.uid}/following/${creatorId}`);
    const creatorFollowersRef = ref(database, `users/${creatorId}/followers/${user.uid}`);
    
    const snapshot = await get(currentUserFollowingRef);
    
    if (snapshot.exists()) {
        // 언팔로우
        await remove(currentUserFollowingRef);
        await remove(creatorFollowersRef);
        showToast('크리에이터를 언팔로우했습니다.', 'info');
    } else {
        // 팔로우
        await set(currentUserFollowingRef, true);
        await set(creatorFollowersRef, true);
        showToast('크리에이터를 팔로우했습니다.', 'success');
    }
  };

  return { updateUserProfile, toggleFollowCreator };
}