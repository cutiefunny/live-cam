// hooks/useAdminData.js
import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
// ✨ [수정] onSnapshot을 import한 것을 확인 (getDocs는 더 이상 필요 없음)
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { database, firestore } from '@/lib/firebase';
import { useUsers } from '@/hooks/useUsers';

export function useAdminData() {
  const { users: allAuthUsers, isLoading: isUsersLoading } = useUsers();
  const [onlineCreators, setOnlineCreators] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [usersWithRoles, setUsersWithRoles] = useState([]);
  const [coinHistory, setCoinHistory] = useState([]);
  
  // ✨ [추가] Firestore 유저 정보를 실시간으로 담을 state
  const [allFirestoreUsers, setAllFirestoreUsers] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [chargeRequests, setChargeRequests] = useState([]); 
  // const [applicants, setApplicants] = useState([]); // (제거됨)

  const [dashboardData, setDashboardData] = useState({
    newUsers: [],
    weeklyCoinStats: { labels: [], datasets: [] },
  });

  // 온라인 크리에이터 목록 (RealtimeDB 유지)
  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      setOnlineCreators(data ? Object.values(data) : []);
    });
    return () => off(creatorsRef, 'value', listener);
  }, []);

  // ✨ [수정] Firestore에서 데이터 실시간 구독
  useEffect(() => {
    const historyQuery = query(collection(firestore, 'call_history'), orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const historyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCallHistory(historyList);
    });

    const coinHistoryQuery = query(collection(firestore, 'coin_history'), orderBy('timestamp', 'desc'));
    const unsubscribeCoinHistory = onSnapshot(coinHistoryQuery, (snapshot) => {
      const historyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCoinHistory(historyList);
    });

    const requestsQuery = query(collection(firestore, 'charge_requests'), where('status', '==', 'pending'), orderBy('timestamp', 'asc'));
    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      const pendingRequests = snapshot.docs.map(doc => ({ requestId: doc.id, ...doc.data() }));
      setChargeRequests(pendingRequests);
    });

    // ✨ [추가] 'users' 컬렉션 전체를 실시간 구독
    const usersQuery = query(collection(firestore, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersFromDB = {};
      snapshot.forEach(doc => {
        usersFromDB[doc.id] = doc.data();
      });
      // Firestore 데이터를 state에 저장
      setAllFirestoreUsers(usersFromDB);
    });

    return () => {
      unsubscribeHistory();
      unsubscribeCoinHistory();
      unsubscribeRequests();
      unsubscribeUsers(); // ✨ [추가] 구독 해제
    };
  }, []);
  
  // ✨ [수정] Auth 유저 목록과 Firestore 유저 목록을 병합하는 로직
  useEffect(() => {
    // Auth 유저 로딩이 끝났고, Firestore 유저 데이터가 로드되었는지 확인
    if (isUsersLoading || allFirestoreUsers === null) {
      setIsLoading(true);
      return;
    }

    if (allAuthUsers.length === 0) {
      setIsLoading(false);
      setUsersWithRoles([]);
      return;
    }

    // Auth 유저 목록(allAuthUsers)과 실시간 Firestore 유저 목록(allFirestoreUsers)을 병합
    const mergedUsers = allAuthUsers.map(authUser => ({
      ...authUser, // Auth 정보 (uid, email, creationTime)
      ...(allFirestoreUsers[authUser.uid] || {}), // Firestore 정보 (isCreator, coins, gender, applicationStatus 등)
    }));
    
    setUsersWithRoles(mergedUsers);

    // 대시보드용 신규 유저 필터링
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const newUsers = mergedUsers.filter(u => new Date(u.creationTime).getTime() > twentyFourHoursAgo);
    setDashboardData(prev => ({ ...prev, newUsers }));

    setIsLoading(false); // 로딩 완료

  }, [allAuthUsers, isUsersLoading, allFirestoreUsers]); // allFirestoreUsers가 변경될 때마다 이 훅이 실행됨

  // ... (주간 코인 통계 useEffect는 변경 없음) ...
  useEffect(() => {
    if (coinHistory.length === 0) return;

    const today = new Date();
    const labels = Array(7).fill(0).map((_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - i));
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    });

    const chargeData = Array(7).fill(0);
    const usageData = Array(7).fill(0);

    coinHistory.forEach(log => {
        if (!log.timestamp) return;
        const logDate = log.timestamp.toDate(); // Firestore 타임스탬프 변환
        const diffDays = Math.floor((today - logDate) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < 7) {
            const index = 6 - diffDays;
            if (['admin_give', 'charge', 'gift_earn', 'earn'].includes(log.type)) {
                chargeData[index] += log.amount;
            } else if (['admin_take', 'use', 'gift_use'].includes(log.type)) {
                usageData[index] += log.amount;
            }
        }
    });
    
    setDashboardData(prev => ({
        ...prev,
        weeklyCoinStats: {
            labels,
            datasets: [
                {
                    label: '코인 지급/충전/획득',
                    data: chargeData,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                },
                {
                    label: '코인 회수/사용',
                    data: usageData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                }
            ]
        }
    }));
  }, [coinHistory]);

  return { 
    onlineCreators, 
    callHistory, 
    usersWithRoles, 
    setUsersWithRoles,
    coinHistory,
    chargeRequests, 
    applicants: [], // (사용되지 않으므로 빈 배열)
    dashboardData,
    isLoading: isLoading // ✨ [수정]
  };
}