// hooks/useCoin.js
import { collection, addDoc, doc, getDoc, runTransaction as firestoreTransaction, serverTimestamp } from 'firebase/firestore';
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

    const settingsDoc = await getDoc(settingsDocRef);
    const creatorShareRate = settingsDoc.data()?.creatorShareRate || 90;
    const payoutAmount = Math.floor(cost * (creatorShareRate / 100));

    // ✨ [수정] Firestore 트랜잭션을 사용하여 코인 차감 및 지급
    await firestoreTransaction(firestore, async (transaction) => {
      const fromUserDoc = await transaction.get(fromUserDocRef);
      const currentCoins = fromUserDoc.data()?.coins || 0;

      if (currentCoins < cost) {
        throw new Error("Not enough coins");
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
    
    // ✨ [수정] 'coin_history' 컬렉션에 문서 추가 (배치 사용)
    const fromUserData = (await getDoc(fromUserDocRef)).data();
    const toUserData = (await getDoc(toUserDocRef)).data();
    const historyColRef = collection(firestore, 'coin_history');

    await addDoc(historyColRef, {
      userId: fromUserId,
      userName: fromUserData?.displayName,
      userEmail: fromUserData?.email,
      type: 'gift_use',
      amount: cost,
      timestamp: serverTimestamp(),
      description: `${toUserData?.displayName}에게 ${gift.name} 선물`
    });
    await addDoc(historyColRef, {
      userId: toUserId,
      userName: toUserData?.displayName,
      userEmail: toUserData?.email,
      type: 'gift_earn',
      amount: payoutAmount,
      timestamp: serverTimestamp(),
      description: `${fromUserData?.displayName}에게 ${gift.name} 선물 받음`
    });
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