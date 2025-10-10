// hooks/useCoin.js
// ✨ [수정] writeBatch를 import 목록에 추가합니다.
import { collection, addDoc, doc, getDoc, runTransaction as firestoreTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, push, get, runTransaction } from 'firebase/database';
import { database, firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useCoin() {
  const { user, showToast } = useAppStore();

  const requestCoinCharge = async (amount, price) => {
    if (!user) throw new Error("User not logged in");

    // ✨ [수정] 'charge_requests' 컬렉션에 문서 추가
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

      await firestoreTransaction(firestore, async (transaction) => {
        const fromUserDoc = await transaction.get(fromUserDocRef);
        const currentCoins = fromUserDoc.data()?.coins || 0;

        if (currentCoins < cost) {
          throw new Error("코인이 부족합니다.");
        }

        transaction.update(fromUserDocRef, { coins: currentCoins - cost });
        
        const toUserDoc = await transaction.get(toUserDocRef);
        const toUserCoins = toUserDoc.data()?.coins || 0;
        transaction.update(toUserDocRef, { coins: toUserCoins + payoutAmount });
      });

      // 선물 이벤트는 실시간성이 중요하므로 RealtimeDB 유지
      const roomGiftsRef = ref(database, `rooms/${roomId}/gifts`);
      await push(roomGiftsRef, {
        ...gift,
        senderId: fromUserId,
        senderName: user.displayName,
        timestamp: Date.now(),
      });
      
      // ✨ [수정] Firestore 'coin_history' 기록을 writeBatch로 원자적 처리
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
       // 에러를 다시 throw하여 호출한 쪽에서 처리하도록 합니다.
       throw error;
    }
  };

  const submitRating = async (creatorId, rating, comment) => {
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    
    try {
      // ✨ [수정] 'creator_ratings' 컬렉션에 후기 문서 추가
      const ratingColRef = collection(firestore, 'creator_ratings');
      await addDoc(ratingColRef, {
        creatorId: creatorId,
        rating: rating,
        comment: comment,
        callerId: user.uid,
        callerName: user.displayName,
        timestamp: serverTimestamp()
      });

      // ✨ [수정] Firestore 트랜잭션으로 크리에이터 프로필 업데이트
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