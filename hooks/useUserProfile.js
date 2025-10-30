// hooks/useUserProfile.js
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage, firestore } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';

export function useUserProfile() {
  // ✨ [수정] setUserGender 제거 (useAuth가 Firestore 리스너로 자동 갱신)
  const { user, setUser, showToast } = useAppStore();

  // ✨ [수정] newGender 인수 추가
  const updateUserProfile = async (newDisplayName, newAvatarFile, newGender) => {
    if (!user) return;

    let newPhotoURL = user.photoURL;
    // ✨ [수정] dataToUpdate 객체로 관리
    const dataToUpdate = {
      displayName: newDisplayName,
      gender: newGender === 'unset' ? null : newGender,
    };

    try {
      if (newAvatarFile) {
        const processedImageBlob = await processImageForUpload(newAvatarFile, 400);
        const avatarRef = storageRef(storage, `avatars/${user.uid}`);
        const snapshot = await uploadBytes(avatarRef, processedImageBlob);
        newPhotoURL = await getDownloadURL(snapshot.ref);
        dataToUpdate.photoURL = newPhotoURL; // ✨ [추가]
      }

      await updateProfile(auth.currentUser, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

      const userDocRef = doc(firestore, 'users', user.uid);
      // ✨ [수정] dataToUpdate 객체로 Firestore 문서 업데이트
      await updateDoc(userDocRef, dataToUpdate);

      // ✨ [수정] 로컬 Auth 객체만 업데이트 (Firestore 데이터는 useAuth 리스너가 갱신)
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
