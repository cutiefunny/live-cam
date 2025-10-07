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
  const [coinHistory, setCoinHistory] = useState([]); // ✨ [추가] 코인 내역 state
  const [isLoading, setIsLoading] = useState(true);

  // 온라인 크리에이터 목록 가져오기
  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      setOnlineCreators(data ? Object.values(data) : []);
    });
    return () => off(creatorsRef, 'value', listener);
  }, []);

  // 통화 기록 가져오기
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

  // ✨ [추가] 코인 변동 내역 가져오기
  useEffect(() => {
    const coinHistoryRef = ref(database, 'coin_history');
    const listener = onValue(coinHistoryRef, (snapshot) => {
        const data = snapshot.val();
        const historyList = data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : [];
        historyList.sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬
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
      setIsLoading(false);
    });
  }, [allAuthUsers, isUsersLoading]);

  return { 
    onlineCreators, 
    callHistory, 
    usersWithRoles, 
    setUsersWithRoles,
    coinHistory, // ✨ [추가]
    isLoading: isUsersLoading || isLoading 
  };
}