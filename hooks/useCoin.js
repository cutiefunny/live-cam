// hooks/useCoin.js
import { ref, push, runTransaction, get, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useCoin() {
  const { user, showToast } = useAppStore();

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

  return { requestCoinCharge, sendGift, submitRating };
}