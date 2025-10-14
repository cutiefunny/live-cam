// hooks/useCallHandler.js
'use client';
import { useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, addDoc, serverTimestamp, runTransaction, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

export function useCallHandler(remoteStream, callPartner) {
  const router = useRouter();
  const { user, isCreator, settings, showToast, openRatingModal } = useAppStore();
  
  const callStartTimeRef = useRef(null);
  const callEndedRef = useRef(false);
  const coinDeductionIntervalRef = useRef(null);

  const executeLeaveRoom = useCallback(async (duration) => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;

    if (coinDeductionIntervalRef.current) {
      clearInterval(coinDeductionIntervalRef.current);
    }

    try {
      if (!isCreator && callPartner && duration > 10000) { // 10초 이상 통화 시
          const historyRef = collection(firestore, 'call_history');
          await addDoc(historyRef, {
              callerId: user.uid,
              callerName: user.displayName,
              calleeId: callPartner.uid,
              calleeName: callPartner.displayName,
              roomId: callPartner.roomId,
              timestamp: serverTimestamp(),
              duration: duration
          });
          openRatingModal({ creatorId: callPartner.uid, creatorName: callPartner.displayName });
      }
    } catch (error) {
      console.error("Failed to record call history:", error);
      showToast('통화 내역 기록에 실패했습니다.', 'error');
    } finally {
      router.replace('/');
    }
  }, [isCreator, callPartner, user, openRatingModal, router, showToast]);

  useEffect(() => {
    // ✨ [수정 시작]
    // 1. 스트림이 없거나 기본 정보가 없으면 바로 종료합니다.
    if (!remoteStream || !settings || !user || !callPartner) {
        if(coinDeductionIntervalRef.current) clearInterval(coinDeductionIntervalRef.current);
        return;
    }

    // 2. 통화 시작 시간을 기록합니다. 이 로직은 발신자와 수신자 모두에게 필요합니다.
    console.log('[useCallHandler] Call timer started.');
    callStartTimeRef.current = Date.now();

    // 3. 발신자(isCreator가 false)인 경우에만 코인 차감 로직을 실행합니다.
    if (!isCreator) {
      const { costToStart, costPerMinute, creatorShareRate } = settings;

      const deduct = async (amount, type, description) => {
          const userCoinRef = doc(firestore, 'users', user.uid);
          const creatorCoinRef = doc(firestore, 'users', callPartner.uid);
          const payoutAmount = Math.floor(amount * (creatorShareRate / 100));

          try {
              await runTransaction(firestore, async (transaction) => {
                  const userDoc = await transaction.get(userCoinRef);
                  const creatorDoc = await transaction.get(creatorCoinRef);
                  
                  if (!userDoc.exists()) throw new Error("User document does not exist.");

                  const currentCoins = userDoc.data().coins || 0;
                  if (currentCoins < amount) throw new Error('코인이 부족합니다.');
                  
                  transaction.update(userCoinRef, { coins: currentCoins - amount });
                  
                  const creatorCoins = creatorDoc.exists() ? creatorDoc.data().coins || 0 : 0;
                  transaction.update(creatorCoinRef, { coins: creatorCoins + payoutAmount });
              });

              const historyColRef = collection(firestore, 'coin_history');
              await addDoc(historyColRef, { userId: user.uid, userName: user.displayName, userEmail: user.email, type: 'use', amount: amount, timestamp: serverTimestamp(), description: description });
              
              const creatorData = (await getDoc(creatorCoinRef)).data();
              await addDoc(historyColRef, { userId: callPartner.uid, userName: creatorData?.displayName, userEmail: creatorData?.email, type: 'earn', amount: payoutAmount, timestamp: serverTimestamp(), description: `Video call with ${user.displayName}` });

              return true;
          } catch (e) {
              showToast(e.message, 'error');
              executeLeaveRoom(Date.now() - callStartTimeRef.current);
              return false;
          }
      };

      const startDeduction = async () => {
        if (costToStart > 0) {
          const success = await deduct(costToStart, 'start', `Video call with ${callPartner.displayName} (start fee)`);
          if (!success) return;
        }
        
        coinDeductionIntervalRef.current = setInterval(() => {
          deduct(costPerMinute, 'minute', `Video call with ${callPartner.displayName} (per minute)`);
        }, 60000);
      };

      startDeduction();
    }
    // ✨ [수정 끝]

    return () => {
      if (coinDeductionIntervalRef.current) {
        clearInterval(coinDeductionIntervalRef.current);
      }
      if(callStartTimeRef.current){
          executeLeaveRoom(Date.now() - callStartTimeRef.current);
      }
    };
  }, [isCreator, remoteStream, settings, user, callPartner, showToast, executeLeaveRoom]);

  return { executeLeaveRoom, callStartTimeRef };
}