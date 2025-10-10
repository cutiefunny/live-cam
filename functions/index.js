const functions = require("firebase-functions");
const admin = require("firebase-admin");

try {
  admin.initializeApp();
} catch (e) {
  /* 이미 초기화된 경우 무시 */
}

const firestoreDb = admin.firestore();
const realtimeDb = admin.database();

/**
 * Firestore의 'users' 컬렉션 문서가 변경될 때마다
 * Realtime Database의 'creators' 경로를 동기화하는 함수
 */
exports.syncCreatorToRealtimeDB = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    const { userId } = context.params;
    const creatorRef = realtimeDb.ref(`creators/${userId}`);

    if (!change.after.exists) {
      functions.logger.log(`User ${userId} deleted, removing from RTDB.`);
      return creatorRef.remove();
    }

    const userData = change.after.data();

    if (userData.isCreator) {
      functions.logger.log(`Syncing creator ${userId} to RTDB.`);
      const snapshot = await creatorRef.child("status").once("value");
      const status = snapshot.val() || "offline";

      return creatorRef.set({
        uid: userId,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        status: status,
      });
    } else {
      functions.logger.log(`User ${userId} is not a creator, ensuring removal from RTDB.`);
      return creatorRef.remove();
    }
  });

/**
 * 'call_history'에 문서가 생성될 때마다
 * 크리에이터의 총 통화 시간을 'users' 문서에 업데이트하는 함수
 */
exports.updateCreatorTotalCallTime = functions.firestore
  .document("call_history/{callId}")
  .onCreate(async (snap, context) => {
    const callData = snap.data();
    // ✨ Firestore 타임스탬프 객체를 올바르게 처리하도록 수정
    const { calleeId, duration, timestamp } = callData;

    if (!calleeId || !duration || !timestamp) {
      functions.logger.log("calleeId, duration, or timestamp is missing.", callData);
      return null;
    }

    const creatorRef = firestoreDb.doc(`users/${calleeId}`);

    try {
      await firestoreDb.runTransaction(async (transaction) => {
        const creatorDoc = await transaction.get(creatorRef);

        if (!creatorDoc.exists) {
          functions.logger.warn(`Creator document ${calleeId} does not exist.`);
          return;
        }

        const currentTotalCallTime = creatorDoc.data().totalCallTime || 0;
        const newTotalCallTime = currentTotalCallTime + duration;

        transaction.update(creatorRef, { totalCallTime: newTotalCallTime });
        functions.logger.log(
          `Updated totalCallTime for creator ${calleeId} to ${newTotalCallTime}ms.`
        );
      });
    } catch (error) {
      functions.logger.error(
        `Failed to update totalCallTime for creator ${calleeId}`,
        error
      );
    }

    return null;
  });

/**
 * ✨ [신규 추가] 사용자가 통화방에서 나갈 때 통화 기록 및 코인 정산을 처리하는 함수
 */
exports.finalizeCall = functions.database
  .ref("rooms/{roomId}/users/{userId}")
  .onDelete(async (snap, context) => {
    const { roomId, userId: leavingUserId } = context.params;
    const leavingUserData = snap.val();

    // joinTime이 없거나 비정상적인 퇴장이면 함수 종료
    if (!leavingUserData || !leavingUserData.joinTime) {
      functions.logger.log(`User ${leavingUserId} left room ${roomId} without joinTime. Skipping.`);
      return null;
    }

    const duration = Date.now() - leavingUserData.joinTime;

    // 최소 통화 시간 (예: 10초) 미만이면 기록 및 정산하지 않음
    if (duration < 10000) {
      functions.logger.log(`Call duration for ${leavingUserId} was too short (${duration}ms). Skipping.`);
      return null;
    }

    const roomUsersRef = realtimeDb.ref(`rooms/${roomId}/users`);
    const remainingUsersSnapshot = await roomUsersRef.once("value");
    const remainingUsers = remainingUsersSnapshot.val();

    if (!remainingUsers) {
      functions.logger.log(`Room ${roomId} is empty. Last user left. Cleaning up room.`);
      await realtimeDb.ref(`rooms/${roomId}`).remove();
      return null;
    }

    const otherUserId = Object.keys(remainingUsers)[0];
    const otherUserData = remainingUsers[otherUserId];

    const leavingUserDoc = await firestoreDb.doc(`users/${leavingUserId}`).get();
    const otherUserDoc = await firestoreDb.doc(`users/${otherUserId}`).get();

    if (!leavingUserDoc.exists || !otherUserDoc.exists) {
      functions.logger.error("Could not find user documents for billing.");
      return null;
    }

    const leavingUser = { uid: leavingUserId, ...leavingUserDoc.data() };
    const otherUser = { uid: otherUserId, ...otherUserDoc.data() };

    const caller = !leavingUser.isCreator ? leavingUser : otherUser;
    const callee = leavingUser.isCreator ? leavingUser : otherUser;

    if (caller.isCreator || !callee.isCreator) {
      functions.logger.log("Invalid call participants (both creators or both users). Skipping billing.");
      return null;
    }
    
    // 1. 통화 기록 저장
    const callHistoryRef = firestoreDb.collection("call_history");
    await callHistoryRef.add({
      callerId: caller.uid,
      callerName: caller.displayName,
      calleeId: callee.uid,
      calleeName: callee.displayName,
      roomId: roomId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      duration: duration,
    });
    functions.logger.log(`Call history saved for room ${roomId}.`);

    // 2. 코인 정산
    const settingsDoc = await firestoreDb.doc("settings/live").get();
    const settings = settingsDoc.data() || {};
    const costToStart = settings.costToStart || 3;
    const costPerMinute = settings.costPerMinute || 1;
    const creatorShareRate = settings.creatorShareRate || 90;

    // 통화 시작 비용 + 분당 비용 계산 (올림 처리)
    const totalMinutes = Math.ceil(duration / 60000);
    const totalCost = costToStart + (totalMinutes * costPerMinute);
    const creatorEarnings = Math.floor((totalMinutes * costPerMinute) * (creatorShareRate / 100));

    const callerRef = firestoreDb.doc(`users/${caller.uid}`);
    const calleeRef = firestoreDb.doc(`users/${callee.uid}`);

    try {
      await firestoreDb.runTransaction(async (t) => {
        const callerDoc = await t.get(callerRef);
        const calleeDoc = await t.get(calleeRef);
        
        const callerCoins = callerDoc.data().coins || 0;
        const calleeCoins = calleeDoc.data().coins || 0;

        if (callerCoins < totalCost) {
          functions.logger.warn(`Caller ${caller.uid} has insufficient funds.`);
          // 여기서는 일단 차감하지만, 실제 서비스에서는 마이너스 처리 정책 필요
        }

        t.update(callerRef, { coins: callerCoins - totalCost });
        t.update(calleeRef, { coins: calleeCoins + creatorEarnings });
      });

      // 코인 사용/획득 내역 기록
      const coinHistoryCol = firestoreDb.collection("coin_history");
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      await coinHistoryCol.add({
        userId: caller.uid, userName: caller.displayName, userEmail: caller.email,
        type: "use", amount: totalCost, timestamp,
        description: `Video call with ${callee.displayName}`,
      });
      await coinHistoryCol.add({
        userId: callee.uid, userName: callee.displayName, userEmail: callee.email,
        type: "earn", amount: creatorEarnings, timestamp,
        description: `Video call with ${caller.displayName}`,
      });

      functions.logger.log(`Billing complete for call in room ${roomId}.`);
    } catch (e) {
      functions.logger.error(`Transaction failed for room ${roomId}:`, e);
    }
    
    return null;
  });