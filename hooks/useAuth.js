// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { ref, set, onValue, off, onDisconnect, get, remove, update, push, runTransaction, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';
import { nanoid } from 'nanoid';

export function useAuth() {
  const { user, setUser, setIsCreator, setIsAuthLoading, showToast, setFollowing } = useAppStore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [setUser, setIsAuthLoading]);

  useEffect(() => {
    if (!user) {
      setIsCreator(false);
      setFollowing([]); // ✨ [추가] 로그아웃 시 팔로잉 목록 초기화
      return;
    }

    const userRef = ref(database, `users/${user.uid}`);
    const followingRef = ref(database, `users/${user.uid}/following`);

    const dbUnsubscribe = onValue(userRef, (snapshot) => {
      const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
      setIsCreator(isUserCreator);
    });
    
    // ✨ [추가] 사용자의 팔로잉 목록을 실시간으로 감지하여 스토어에 업데이트
    const followingListener = onValue(followingRef, (snapshot) => {
        const followingData = snapshot.val() || {};
        setFollowing(Object.keys(followingData));
    });

    return () => {
        dbUnsubscribe();
        off(followingRef, 'value', followingListener);
    };
  }, [user, setIsCreator, setFollowing]);

  // ... (signIn, signOut, goOnline, goOffline, updateUserProfile, etc. are unchanged)
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
  };
  
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
      status: 'pending',
    });
  };

  const sendGift = async (fromUserId, toUserId, gift, roomId) => {
    const { cost } = gift;
    const userCoinRef = ref(database, `users/${fromUserId}/coins`);
    const settingsRef = ref(database, 'settings');

    const settingsSnapshot = await get(settingsRef);
    const creatorShareRate = settingsSnapshot.val()?.creatorShareRate || 90;
    const payoutAmount = Math.floor(cost * (creatorShareRate / 100));

    const { committed } = await runTransaction(userCoinRef, (currentCoins) => {
      if (currentCoins < cost) {
        return;
      }
      return currentCoins - cost;
    });

    if (!committed) {
      throw new Error("Not enough coins");
    }

    const creatorCoinRef = ref(database, `users/${toUserId}/coins`);
    await runTransaction(creatorCoinRef, (currentCoins) => (currentCoins || 0) + payoutAmount);

    const roomGiftsRef = ref(database, `rooms/${roomId}/gifts`);
    await push(roomGiftsRef, {
      ...gift,
      senderId: fromUserId,
      senderName: user.displayName,
      timestamp: Date.now(),
    });
    
    const coinHistoryRef = ref(database, 'coin_history');
    const fromUserData = await get(ref(database, `users/${fromUserId}`));
    const toUserData = await get(ref(database, `users/${toUserId}`));

    await push(coinHistoryRef, {
      userId: fromUserId,
      userName: fromUserData.val()?.displayName,
      userEmail: fromUserData.val()?.email,
      type: 'gift_use',
      amount: cost,
      timestamp: Date.now(),
      description: `${toUserData.val()?.displayName}에게 ${gift.name} 선물`
    });
    await push(coinHistoryRef, {
      userId: toUserId,
      userName: toUserData.val()?.displayName,
      userEmail: toUserData.val()?.email,
      type: 'gift_earn',
      amount: payoutAmount,
      timestamp: Date.now(),
      description: `${fromUserData.val()?.displayName}에게 ${gift.name} 선물 받음`
    });
  };

  const submitRating = async (creatorId, rating, comment) => {
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    
    try {
      const ratingRef = ref(database, `creator_ratings/${creatorId}`);
      await push(ratingRef, {
        rating: rating,
        comment: comment,
        callerId: user.uid,
        callerName: user.displayName,
        timestamp: serverTimestamp()
      });

      const creatorProfileRef = ref(database, `creator_profiles/${creatorId}`);
      await runTransaction(creatorProfileRef, (profile) => {
        if (profile) {
          const oldRatingCount = profile.ratingCount || 0;
          const oldAverageRating = profile.averageRating || 0;
          
          const newRatingCount = oldRatingCount + 1;
          const newAverageRating = ((oldAverageRating * oldRatingCount) + rating) / newRatingCount;
          
          profile.ratingCount = newRatingCount;
          profile.averageRating = newAverageRating;
        } else {
          profile = {
            bio: '',
            ratingCount: 1,
            averageRating: rating
          };
        }
        return profile;
      });
      
      showToast('소중한 후기 감사합니다!', 'success');
    } catch (error) {
      console.error("Failed to submit rating:", error);
      showToast('후기 제출에 실패했습니다.', 'error');
    }
  };

  // ... (uploadCreatorPhotos, deleteCreatorPhoto, updateCreatorPhotoOrder are unchanged)
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

  // ✨ [추가] 팔로우/언팔로우 토글 함수
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

  return { signIn, signOut, goOnline, goOffline, updateUserProfile, requestCoinCharge, sendGift, submitRating, uploadCreatorPhotos, deleteCreatorPhoto, updateCreatorPhotoOrder, toggleFollowCreator };
}