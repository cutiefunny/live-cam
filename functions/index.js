const functions = require("firebase-functions");
const admin = require("firebase-admin");

// admin.initializeApp()는 파일 상단에 한 번만 있으면 됩니다.
// 이미 있다면 이 줄은 추가하지 마세요.
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
 * ✨ [신규 추가] 'call_history'에 문서가 생성될 때마다
 * 크리에이터의 총 통화 시간을 'users' 문서에 업데이트하는 함수
 */
exports.updateCreatorTotalCallTime = functions.firestore
  .document("call_history/{callId}")
  .onCreate(async (snap, context) => {
    const callData = snap.data();
    const { calleeId, duration } = callData;

    if (!calleeId || !duration) {
      functions.logger.log("calleeId or duration is missing, skipping.", callData);
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