// hooks/useAdminData.js
import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore'; // ✨ [추가]
import { database, firestore } from '@/lib/firebase'; // ✨ [수정]
import { useUsers } from '@/hooks/useUsers';

export function useAdminData() {
  const { users: allAuthUsers, isLoading: isUsersLoading } = useUsers();
  const [onlineCreators, setOnlineCreators] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [usersWithRoles, setUsersWithRoles] = useState([]);
  const [coinHistory, setCoinHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chargeRequests, setChargeRequests] = useState([]); 
  const [applicants, setApplicants] = useState([]); // ✨ [추가] 신청자 목록 state

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

  // ✨ [수정 시작] Firestore에서 데이터 구독
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

    // ✨ [추가] 'applications' 컬렉션에서 'pending' 상태인 신청서 구독 (createdAt 기준으로 오름차순)
    const applicationsQuery = query(collection(firestore, 'applications'), where('status', '==', 'pending'), orderBy('createdAt', 'asc'));
    const unsubscribeApplications = onSnapshot(applicationsQuery, (snapshot) => {
      const pendingApplicants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplicants(pendingApplicants);
    });

    return () => {
      unsubscribeHistory();
      unsubscribeCoinHistory();
      unsubscribeRequests();
      unsubscribeApplications(); // ✨ [추가] 구독 해제
    };
  }, []);
  // ✨ [수정 끝]
  
  // 전체 유저 목록에 역할 정보 병합
  useEffect(() => {
    if (isUsersLoading) return;
    if (allAuthUsers.length === 0) {
      setIsLoading(false);
      return;
    }

    // ✨ [수정] Firestore에서 모든 사용자 정보 가져오기
    getDocs(collection(firestore, 'users')).then((snapshot) => {
      const usersFromDB = {};
      snapshot.forEach(doc => {
        usersFromDB[doc.id] = doc.data();
      });

      const mergedUsers = allAuthUsers.map(authUser => ({
        ...authUser,
        ...usersFromDB[authUser.uid],
      }));
      setUsersWithRoles(mergedUsers);

      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const newUsers = mergedUsers.filter(u => new Date(u.creationTime).getTime() > twentyFourHoursAgo);
      setDashboardData(prev => ({ ...prev, newUsers }));

      setIsLoading(false);
    });
  }, [allAuthUsers, isUsersLoading]);

  // 주간 코인 통계 계산 (기존 로직 대부분 유지)
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
    applicants, // ✨ [추가]
    dashboardData,
    isLoading: isUsersLoading || isLoading 
  };
}