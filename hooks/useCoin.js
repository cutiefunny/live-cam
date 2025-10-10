// hooks/useCoin.js
import { collection, addDoc, doc, getDoc, runTransaction as firestoreTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, push } from 'firebase/database';
import { database, firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useCoin() {
  const { user, showToast } = useAppStore();

  const requestCoinCharge = async (amount, price) => {
    if (!user) throw new Error("User not logged in");

    const requestsColRef = collection(firestore, 'charge_requests');
    await addDoc(requestsColRef, {
      userId: user.uid,
      userName: user.displayName,
      userEmail: user.email,
      amount: amount,
      price: price,
      timestamp: serverTimestamp(),
      status: 'pending',
    });
  };

  const sendGift = async (fromUserId, toUserId, gift, roomId) => {
    const { cost } = gift;
    const fromUserDocRef = doc(firestore, 'users', fromUserId);
    const toUserDocRef = doc(firestore, 'users', toUserId);
    const settingsDocRef = doc(firestore, 'settings', 'live');
    const historyColRef = collection(firestore, 'coin_history');

    try {
      const settingsDoc = await getDoc(settingsDocRef);
      const creatorShareRate = settingsDoc.data()?.creatorShareRate || 90;
      const payoutAmount = Math.floor(cost * (creatorShareRate / 100));

      // ✨ [수정 시작] Firestore 트랜잭션 로직 수정
      await firestoreTransaction(firestore, async (transaction) => {
        // 1. 모든 읽기(get) 작업을 먼저 수행합니다.
        const fromUserDoc = await transaction.get(fromUserDocRef);
        const toUserDoc = await transaction.get(toUserDocRef);

        if (!fromUserDoc.exists()) {
          throw new Error("선물을 보내는 사용자를 찾을 수 없습니다.");
        }

        const currentCoins = fromUserDoc.data().coins || 0;
        if (currentCoins < cost) {
          throw new Error("코인이 부족합니다.");
        }

        // 2. 모든 쓰기(update) 작업을 이후에 수행합니다.
        transaction.update(fromUserDocRef, { coins: currentCoins - cost });
        
        const toUserCoins = toUserDoc.exists() ? toUserDoc.data().coins || 0 : 0;
        transaction.update(toUserDocRef, { coins: toUserCoins + payoutAmount });
      });
      // ✨ [수정 끝]

      const roomGiftsRef = ref(database, `rooms/${roomId}/gifts`);
      await push(roomGiftsRef, {
        ...gift,
        senderId: fromUserId,
        senderName: user.displayName,
        timestamp: Date.now(),
      });
      
      const fromUserData = (await getDoc(fromUserDocRef)).data();
      const toUserData = (await getDoc(toUserDocRef)).data();
      
      const batch = writeBatch(firestore);
      
      const giftUseHistoryRef = doc(historyColRef);
      batch.set(giftUseHistoryRef, {
        userId: fromUserId,
        userName: fromUserData?.displayName,
        userEmail: fromUserData?.email,
        type: 'gift_use',
        amount: cost,
        timestamp: serverTimestamp(),
        description: `${toUserData?.displayName}에게 ${gift.name} 선물`
      });

      const giftEarnHistoryRef = doc(historyColRef);
      batch.set(giftEarnHistoryRef, {
        userId: toUserId,
        userName: toUserData?.displayName,
        userEmail: toUserData?.email,
        type: 'gift_earn',
        amount: payoutAmount,
        timestamp: serverTimestamp(),
        description: `${fromUserData?.displayName}에게 ${gift.name} 선물 받음`
      });

      await batch.commit();

    } catch (error) {
       console.error("Failed to send gift:", error);
       throw error;
    }
  };

  const submitRating = async (creatorId, rating, comment) => {
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    
    try {
      const ratingColRef = collection(firestore, 'creator_ratings');
      await addDoc(ratingColRef, {
        creatorId: creatorId,
        rating: rating,
        comment: comment,
        callerId: user.uid,
        callerName: user.displayName,
        timestamp: serverTimestamp()
      });

      const creatorProfileDocRef = doc(firestore, 'creator_profiles', creatorId);
      await firestoreTransaction(firestore, async (transaction) => {
        const profileDoc = await transaction.get(creatorProfileDocRef);
        
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          const oldRatingCount = profile.ratingCount || 0;
          const oldAverageRating = profile.averageRating || 0;
          
          const newRatingCount = oldRatingCount + 1;
          const newAverageRating = ((oldAverageRating * oldRatingCount) + rating) / newRatingCount;
          
          transaction.update(creatorProfileDocRef, {
            ratingCount: newRatingCount,
            averageRating: newAverageRating,
          });
        } else {
          transaction.set(creatorProfileDocRef, {
            bio: '',
            ratingCount: 1,
            averageRating: rating
          });
        }
      });
      
      showToast('소중한 후기 감사합니다!', 'success');
    } catch (error) {
      console.error("Failed to submit rating:", error);
      showToast('후기 제출에 실패했습니다.', 'error');
    }
  };

  return { requestCoinCharge, sendGift, submitRating };
}