// hooks/useFilters.js
import { useMemo } from 'react';

export function useFilters(usersWithRoles, callHistory, coinHistory, creatorSearchTerm, generalSearchTerm, historySearchTerm, historySearchFilter, coinHistorySearchTerm, coinHistoryFilter) {
  
  const filteredCreatorUsers = useMemo(() => {
    // 1. 크리에이터별 총 통화 시간 계산
    const callDurations = {};
    callHistory.forEach(call => {
      const calleeId = call.calleeId;
      const duration = call.duration || 0;
      if (!callDurations[calleeId]) {
        callDurations[calleeId] = 0;
      }
      callDurations[calleeId] += duration;
    });

    // 2. 검색어 필터링 및 통화 시간 데이터 추가
    const creators = usersWithRoles
      .filter(user =>
        user.isCreator &&
        (
          user.displayName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(creatorSearchTerm.toLowerCase())
        )
      )
      .map(user => ({
        ...user,
        totalDuration: callDurations[user.uid] || 0,
      }));

    // 3. 총 통화 시간으로 내림차순 정렬
    creators.sort((a, b) => b.totalDuration - a.totalDuration);
    
    return creators;
  }, [usersWithRoles, callHistory, creatorSearchTerm]);

  const filteredGeneralUsers = useMemo(() => {
    // 1. 사용자별 총 충전 코인 합계 계산
    const totalChargedCoins = {};
    coinHistory.forEach(log => {
      if (log.type === 'charge' || log.type === 'admin_give') {
        if (!totalChargedCoins[log.userId]) {
          totalChargedCoins[log.userId] = 0;
        }
        totalChargedCoins[log.userId] += log.amount;
      }
    });

    // 2. 검색어 필터링 및 충전 합계 데이터 추가
    const generalUsers = usersWithRoles
      .filter(user =>
        !user.isCreator &&
        (
          user.displayName?.toLowerCase().includes(generalSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(generalSearchTerm.toLowerCase())
        )
      )
      .map(user => ({
        ...user,
        totalCharged: totalChargedCoins[user.uid] || 0,
      }));
      
    // 3. 총 충전 코인 합계로 내림차순 정렬
    generalUsers.sort((a, b) => b.totalCharged - a.totalCharged);

    return generalUsers;
  }, [usersWithRoles, coinHistory, generalSearchTerm]);

  const filteredCallHistory = useMemo(() => {
    return callHistory.filter(call => {
      const searchTermLower = historySearchTerm.toLowerCase();
      if (!searchTermLower) return true;

      const callerMatch = call.callerName?.toLowerCase().includes(searchTermLower);
      const calleeMatch = call.calleeName?.toLowerCase().includes(searchTermLower);

      switch (historySearchFilter) {
        case 'caller':
          return callerMatch;
        case 'callee':
          return calleeMatch;
        default: // 'all'
          return callerMatch || calleeMatch;
      }
    });
  }, [callHistory, historySearchTerm, historySearchFilter]);

  const filteredCoinHistory = useMemo(() => {
    return coinHistory.filter(log => {
      const typeMatch = coinHistoryFilter === 'all' || log.type === coinHistoryFilter;
      const searchTermLower = coinHistorySearchTerm.toLowerCase();
      const userMatch = log.userName?.toLowerCase().includes(searchTermLower) ||
                        log.userEmail?.toLowerCase().includes(searchTermLower);
      return typeMatch && userMatch;
    });
  }, [coinHistory, coinHistorySearchTerm, coinHistoryFilter]);

  return {
    filteredCreatorUsers,
    filteredGeneralUsers,
    filteredCallHistory,
    filteredCoinHistory,
  };
}