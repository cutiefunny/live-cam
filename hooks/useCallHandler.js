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

  // ✨ useRef 초기값을 null로 명시
  const callStartTimeRef = useRef(null);
  const callEndedRef = useRef(false);
  const coinDeductionIntervalRef = useRef(null);

  const executeLeaveRoom = useCallback((duration) => {
    // ✨ 중복 실행 방지 강화
    if (callEndedRef.current) {
        console.log('[useCallHandler] executeLeaveRoom already called. Skipping.');
        return;
    }
    callEndedRef.current = true; // ✨ 가장 먼저 상태 변경
    console.log(`[useCallHandler] executeLeaveRoom called. Duration: ${duration}ms`); // ✨ 로그 추가

    // 인터벌 정리
    if (coinDeductionIntervalRef.current) {
      clearInterval(coinDeductionIntervalRef.current);
      coinDeductionIntervalRef.current = null; // ✨ 참조 정리
      console.log('[useCallHandler] Coin deduction interval cleared.'); // ✨ 로그 추가
    }

    // 통화 기록 저장 조건 수정: 상대방이 있고, 통화 시간이 0보다 크면 저장
    if (callPartner && duration > 0) {
        console.log(`[useCallHandler] Saving call history. isCreator: ${isCreator}, duration: ${duration}`); // ✨ 로그 추가
        const historyRef = collection(firestore, 'call_history');
        addDoc(historyRef, {
            callerId: user.uid,
            callerName: user.displayName,
            calleeId: callPartner.uid,
            calleeName: callPartner.displayName,
            roomId: callPartner.roomId,
            timestamp: serverTimestamp(),
            duration: duration // 밀리초 단위로 저장
        }).then(() => {
            console.log('[useCallHandler] Call history saved successfully.'); // ✨ 로그 추가
        }).catch(error => {
            console.error('[useCallHandler] Error saving call history:', error); // ✨ 로그 추가
        });

        // 일반 사용자이고 10초 이상 통화한 경우에만 평가 모달 열기
        if (!isCreator && duration > 10000) {
            console.log('[useCallHandler] Opening rating modal.'); // ✨ 로그 추가
            openRatingModal({ creatorId: callPartner.uid, creatorName: callPartner.displayName });
        }
    } else {
        console.log('[useCallHandler] Skipping call history save.', { hasCallPartner: !!callPartner, duration }); // ✨ 로그 추가
    }

    // 페이지 이동은 항상 실행
    console.log('[useCallHandler] Replacing router to /'); // ✨ 로그 추가
    router.replace('/');

  }, [isCreator, callPartner, user, openRatingModal, router]); // ✨ 의존성 배열 업데이트

  useEffect(() => {
    // 코인 차감 로직은 일반 사용자이고, 상대방 스트림이 있고, 설정 로딩이 완료되었을 때만 실행
    if (isCreator || !remoteStream || !settings || !user || !callPartner) {
        console.log('[useCallHandler] Coin deduction useEffect skipped.', { isCreator, hasRemoteStream: !!remoteStream, hasSettings: !!settings, hasUser: !!user, hasCallPartner: !!callPartner }); // ✨ 로그 추가
        // ✨ 조건 불충족 시 시작 시간 및 인터벌 초기화 (중요)
        callStartTimeRef.current = null;
        if(coinDeductionIntervalRef.current) {
            clearInterval(coinDeductionIntervalRef.current);
            coinDeductionIntervalRef.current = null;
        }
        return;
    }

    // 통화 시작 시간 기록 (remoteStream이 처음 유효해지고, 아직 기록되지 않았을 때)
    if (callStartTimeRef.current === null) { // ✨ 단 한번만 기록하도록 조건 추가
        callStartTimeRef.current = Date.now();
        console.log(`[useCallHandler] Call start time recorded: ${callStartTimeRef.current}`); // ✨ 로그 추가
    }

    const { costToStart, costPerMinute, creatorShareRate } = settings;

    // 코인 차감 및 정산 함수
    const deduct = async (amount, type, description) => {
        // ✨ 통화 종료 시 차감 중지
        if (callEndedRef.current) {
            console.log(`[useCallHandler] Skipping deduction for ${type} as call has ended.`);
            return false;
        }

        const userCoinRef = doc(firestore, 'users', user.uid);
        const creatorCoinRef = doc(firestore, 'users', callPartner.uid);
        const payoutAmount = Math.floor(amount * (creatorShareRate / 100));
        console.log(`[useCallHandler] Attempting to deduct ${amount} coins for ${type}. Payout: ${payoutAmount}`); // ✨ 로그 추가

        try {
            let finalUserCoins = 0;
            await runTransaction(firestore, async (transaction) => {
                const userDoc = await transaction.get(userCoinRef);
                const creatorDoc = await transaction.get(creatorCoinRef);

                if (!userDoc.exists()) throw new Error("User document does not exist.");

                const currentCoins = userDoc.data().coins || 0;
                if (currentCoins < amount) {
                    console.error(`[useCallHandler] Insufficient coins. Current: ${currentCoins}, Needed: ${amount}`); // ✨ 로그 추가
                    throw new Error('코인이 부족합니다.');
                }

                finalUserCoins = currentCoins - amount;
                transaction.update(userCoinRef, { coins: finalUserCoins });
                console.log(`[useCallHandler] User coins updated: ${currentCoins} -> ${finalUserCoins}`); // ✨ 로그 추가

                const creatorCoins = creatorDoc.exists() ? creatorDoc.data().coins || 0 : 0;
                const finalCreatorCoins = creatorCoins + payoutAmount;
                transaction.update(creatorCoinRef, { coins: finalCreatorCoins });
                console.log(`[useCallHandler] Creator coins updated: ${creatorCoins} -> ${finalCreatorCoins}`); // ✨ 로그 추가
            });

            // 코인 변경 성공 시 코인 사용/획득 내역 기록
            const historyColRef = collection(firestore, 'coin_history');
            const userHistoryPromise = addDoc(historyColRef, { userId: user.uid, userName: user.displayName, userEmail: user.email, type: 'use', amount: amount, timestamp: serverTimestamp(), description: description });

            const creatorData = (await getDoc(creatorCoinRef)).data(); // 크리에이터 정보 다시 조회
            const creatorHistoryPromise = addDoc(historyColRef, { userId: callPartner.uid, userName: creatorData?.displayName, userEmail: creatorData?.email, type: 'earn', amount: payoutAmount, timestamp: serverTimestamp(), description: `Video call with ${user.displayName}` });

            await Promise.all([userHistoryPromise, creatorHistoryPromise]);
            console.log('[useCallHandler] Coin history saved.'); // ✨ 로그 추가

            // 상태 업데이트 (선택 사항 - 필요한 경우 Zustand 액션 호출)
            // useAppStore.getState().setUserCoins(finalUserCoins);

            return true; // 성공 반환
        } catch (e) {
            console.error("[useCallHandler] Deduction failed:", e.message); // ✨ 에러 로그 강화
            showToast(e.message === '코인이 부족합니다.' ? e.message : '코인 차감 중 오류가 발생했습니다.', 'error'); // ✨ 토스트 메시지 구체화
            // ✨ duration 계산 시 callStartTimeRef.current 유효성 검사 추가 및 즉시 종료
            const duration = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
            if (!callEndedRef.current) { // 중복 호출 방지
                executeLeaveRoom(duration);
            }
            return false; // 실패 반환
        }
    };

    // 차감 로직 시작 함수
    const startDeduction = async () => {
      // costToStart 차감은 통화 시작 시 한 번만 실행
      // ✨ coinDeductionIntervalRef.current가 없을 때만 실행 (인터벌 설정 전인지 확인)
      if (costToStart > 0 && callStartTimeRef.current && !coinDeductionIntervalRef.current && !callEndedRef.current) {
        console.log('[useCallHandler] Deducting start cost:', costToStart); // ✨ 로그 추가
        const success = await deduct(costToStart, 'start', `Video call with ${callPartner.displayName} (start fee)`);
        if (!success) return; // 시작 비용 차감 실패 시 인터벌 설정 안 함
      } else {
        console.log('[useCallHandler] Skipping start cost deduction.', { costToStart, startTimeExists: !!callStartTimeRef.current, intervalExists: !!coinDeductionIntervalRef.current, callEnded: callEndedRef.current }); // ✨ 로그 추가
      }

      // 분당 차감 인터벌 설정 (인터벌이 없고, 통화가 종료되지 않았을 경우)
      if (!coinDeductionIntervalRef.current && !callEndedRef.current) {
        console.log('[useCallHandler] Setting up per-minute deduction interval:', costPerMinute); // ✨ 로그 추가
        coinDeductionIntervalRef.current = setInterval(async () => {
          // 인터벌 실행 중 통화 종료 시 인터벌 클리어
          if (callEndedRef.current) {
            clearInterval(coinDeductionIntervalRef.current);
            coinDeductionIntervalRef.current = null;
            console.log('[useCallHandler] Interval detected call ended, clearing itself.'); // ✨ 로그 추가
            return;
          }
          // 분당 코인 차감 실행
          await deduct(costPerMinute, 'minute', `Video call with ${callPartner.displayName} (per minute)`);
        }, 60000); // 1분 = 60000ms
      }
    };

    // ✨ 통화가 아직 종료되지 않았을 때만 차감 로직 시작
    if (!callEndedRef.current) {
        startDeduction();
    }

    // Cleanup 함수: 컴포넌트 언마운트 또는 의존성 변경 시 실행
    return () => {
      console.log('[useCallHandler] Cleanup function running.'); // ✨ 로그 추가
      // 인터벌 정리
      if (coinDeductionIntervalRef.current) {
        clearInterval(coinDeductionIntervalRef.current);
        coinDeductionIntervalRef.current = null; // ✨ 참조 정리
        console.log('[useCallHandler] Cleanup: Coin deduction interval cleared.'); // ✨ 로그 추가
      }
      // 통화 종료 처리 (아직 종료되지 않았다면)
      if (callStartTimeRef.current && !callEndedRef.current){ // ✨ 종료 여부 확인 추가
          const duration = Date.now() - callStartTimeRef.current;
          console.log(`[useCallHandler] Cleanup: Calling executeLeaveRoom. Duration: ${duration}ms`); // ✨ 로그 추가
          executeLeaveRoom(duration);
      } else {
          console.log('[useCallHandler] Cleanup: Skipping executeLeaveRoom.', { hasStartTime: !!callStartTimeRef.current, callEnded: callEndedRef.current }); // ✨ 로그 추가
      }
      // ✨ 언마운트 시 시작 시간 초기화 (선택적)
      // callStartTimeRef.current = null;
    };
    // ✨ 의존성 배열에 executeLeaveRoom 포함
  }, [isCreator, remoteStream, settings, user, callPartner, showToast, executeLeaveRoom, openRatingModal]);

  // executeLeaveRoom과 callStartTimeRef를 반환하여 외부에서 사용 가능하게 함
  return { executeLeaveRoom, callStartTimeRef };
}