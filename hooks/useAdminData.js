// hooks/useAdminData.js
import { useState, useEffect } from 'react';
import { ref, onValue, off, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useUsers } from '@/hooks/useUsers';

export function useAdminData() {
  const { users: allAuthUsers, isLoading: isUsersLoading } = useUsers();
  const [onlineCreators, setOnlineCreators] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [usersWithRoles, setUsersWithRoles] = useState([]);
  const [coinHistory, setCoinHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dashboardData, setDashboardData] = useState({
    newUsers: [],
    weeklyCoinStats: { labels: [], datasets: [] },
  });

  // ✨ [수정] 온라인 크리에이터 목록 가져오기 로직 복원
  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      setOnlineCreators(data ? Object.values(data) : []);
    });
    return () => off(creatorsRef, 'value', listener);
  }, []);

  // ✨ [수정] 통화 기록 가져오기 로직 복원
  useEffect(() => {
    const historyRef = ref(database, 'call_history');
    const listener = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      const historyList = data 
        ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
        : [];
      historyList.sort((a, b) => b.timestamp - a.timestamp);
      setCallHistory(historyList);
    });
    return () => off(historyRef, 'value', listener);
  }, []);

  // ✨ [수정] 코인 변동 내역 가져오기 로직 복원
  useEffect(() => {
    const coinHistoryRef = ref(database, 'coin_history');
    const listener = onValue(coinHistoryRef, (snapshot) => {
        const data = snapshot.val();
        const historyList = data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : [];
        historyList.sort((a, b) => b.timestamp - a.timestamp);
        setCoinHistory(historyList);
    });
    return () => off(coinHistoryRef, 'value', listener);
  }, []);
  
  // 전체 유저 목록에 역할 정보 병합
  useEffect(() => {
    if (isUsersLoading) return;
    if (allAuthUsers.length === 0) {
      setIsLoading(false);
      return;
    }

    const usersRef = ref(database, 'users');
    get(usersRef).then((snapshot) => {
      const usersFromDB = snapshot.val() || {};
      const mergedUsers = allAuthUsers.map(authUser => ({
        ...authUser,
        isCreator: usersFromDB[authUser.uid]?.isCreator || false,
        lastLogin: usersFromDB[authUser.uid]?.lastLogin || null,
        coins: usersFromDB[authUser.uid]?.coins || 0,
      }));
      setUsersWithRoles(mergedUsers);

      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const newUsers = mergedUsers.filter(u => new Date(u.creationTime).getTime() > twentyFourHoursAgo);
      setDashboardData(prev => ({ ...prev, newUsers }));

      setIsLoading(false);
    });
  }, [allAuthUsers, isUsersLoading]);

  // 주간 코인 통계 계산
  useEffect(() => {
    if (coinHistory.length === 0) return;

    const today = new Date();
    const labels = [];
    const chargeData = Array(7).fill(0);
    const usageData = Array(7).fill(0);

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }));
    }

    coinHistory.forEach(log => {
        const logDate = new Date(log.timestamp);
        // UTC 기준으로 날짜 차이 계산
        const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const logDateUTC = Date.UTC(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const diffDays = Math.floor((todayUTC - logDateUTC) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < 7) {
            const index = 6 - diffDays;
            if (log.type === 'admin_give' || log.type === 'charge') {
                chargeData[index] += log.amount;
            } else if (log.type === 'admin_take' || log.type === 'use') {
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
                    label: '코인 지급/충전',
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
    dashboardData,
    isLoading: isUsersLoading || isLoading 
  };
}