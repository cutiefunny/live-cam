// hooks/useUserProfile.js
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore'; // ✨ [추가]
import { ref, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, database, storage, firestore } from '@/lib/firebase'; // ✨ [수정]
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
      
      // ✨ [수정 시작] Firestore 문서 업데이트
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

      // RealtimeDB의 온라인 크리에이터 정보도 업데이트 (실시간 상태는 RTDB 유지)
      const creatorSnapshot = await get(ref(database, `creators/${user.uid}`));
      if (creatorSnapshot.exists()) {
        await update(ref(database, `creators/${user.uid}`), {
          displayName: newDisplayName,
          photoURL: newPhotoURL,
        });
      }
      // ✨ [수정 끝]
      
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

    // ✨ [수정 시작] Firestore 문서 업데이트 (배치 사용)
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
    // ✨ [수정 끝]
  };

  return { updateUserProfile, toggleFollowCreator };
}