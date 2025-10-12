// hooks/useUserProfile.js
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage, firestore } from '@/lib/firebase';
// import { processImageForUpload } from '@/lib/imageUtils'; // 삭제
import useAppStore from '@/store/useAppStore';

export function useUserProfile() {
  const { user, setUser, showToast } = useAppStore();

  const updateUserProfile = async (newDisplayName, newAvatarFile) => {
    if (!user) return;

    let newPhotoURL = user.photoURL;

    try {
      if (newAvatarFile) {
        // ✨ [수정] 이미지 처리 로직 제거 및 확장자 없는 참조 사용
        const avatarRef = storageRef(storage, `avatars/${user.uid}`);
        const snapshot = await uploadBytes(avatarRef, newAvatarFile);
        newPhotoURL = await getDownloadURL(snapshot.ref);
      }

      await updateProfile(auth.currentUser, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

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

    const currentUserDocRef = doc(firestore, 'users', user.uid);
    const creatorDocRef = doc(firestore, 'users', creatorId);

    const currentUserDoc = await getDoc(currentUserDocRef);
    const isCurrentlyFollowing = (currentUserDoc.data()?.following || []).includes(creatorId);

    const batch = writeBatch(firestore);

    if (isCurrentlyFollowing) {
        // 언팔로우
        batch.update(currentUserDocRef, { following: arrayRemove(creatorId) });
        batch.update(creatorDocRef, { followers: arrayRemove(user.uid) });
        showToast('크리에이터를 언팔로우했습니다.', 'info');
    } else {
        // 팔로우
        batch.update(currentUserDocRef, { following: arrayUnion(creatorId) });
        batch.update(creatorDocRef, { followers: arrayUnion(user.uid) });
        showToast('크리에이터를 팔로우했습니다.', 'success');
    }
    await batch.commit();
  };

  return { updateUserProfile, toggleFollowCreator };
}