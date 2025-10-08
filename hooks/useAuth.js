// hooks/useAuth.js
import { useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { ref, set, onValue, off, onDisconnect, get, remove, update, push, runTransaction, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { processImageForUpload } from '@/lib/imageUtils';
import useAppStore from '@/store/useAppStore';

export function useAuth() {
  const { user, setUser, setIsCreator, setIsAuthLoading, showToast } = useAppStore();

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
      return;
    }

    const userRef = ref(database, `users/${user.uid}`);
    const unsubscribeDB = onValue(userRef, (snapshot) => {
      const isUserCreator = snapshot.exists() && snapshot.val().isCreator === true;
      setIsCreator(isUserCreator);
    });

    return () => unsubscribeDB();
  }, [user, setIsCreator]);

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

    // 1. 사용자 코인 차감
    const { committed } = await runTransaction(userCoinRef, (currentCoins) => {
      if (currentCoins < cost) {
        return; // 잔액 부족으로 중단
      }
      return currentCoins - cost;
    });

    if (!committed) {
      throw new Error("Not enough coins");
    }

    // 2. 크리에이터에게 코인 지급
    const creatorCoinRef = ref(database, `users/${toUserId}/coins`);
    await runTransaction(creatorCoinRef, (currentCoins) => (currentCoins || 0) + payoutAmount);

    // 3. 실시간 이벤트 전송 (애니메이션용)
    const roomGiftsRef = ref(database, `rooms/${roomId}/gifts`);
    await push(roomGiftsRef, {
      ...gift,
      senderId: fromUserId,
      senderName: user.displayName,
      timestamp: Date.now(),
    });
    
    // 4. 코인 사용 내역 기록
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

  // ✨ [추가] 별점 제출 함수
  const submitRating = async (creatorId, rating, comment) => {
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    
    try {
      // 1. 개별 평가 기록 저장
      const ratingRef = ref(database, `creator_ratings/${creatorId}`);
      await push(ratingRef, {
        rating: rating,
        comment: comment,
        callerId: user.uid,
        callerName: user.displayName,
        timestamp: serverTimestamp()
      });

      // 2. 크리에이터 프로필의 평균 별점 및 카운트 업데이트 (트랜잭션)
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
          // 프로필이 없는 경우 새로 생성
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


  return { signIn, signOut, goOnline, goOffline, updateUserProfile, requestCoinCharge, sendGift, submitRating };
}