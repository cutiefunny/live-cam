// hooks/useFilters.js
import { useMemo } from 'react';

// ✨ [수정] props를 'submitted'(신청)와 'approved'(승인)로 명확히 분리
export function useFilters(
  usersWithRoles,
  callHistory,
  coinHistory,
  creatorSearchTerm,
  generalSearchTerm,
  historySearchTerm,
  historySearchFilter,
  coinHistorySearchTerm,
  coinHistoryFilter,
  submittedSearchTerm,   // ✨ 'submitted' (대시보드용)
  creatorGenderFilter, 
  generalGenderFilter, 
  submittedGenderFilter, // ✨ 'submitted' (대시보드용)
  approvedSearchTerm,    // ✨ 'approved' (멤버탭용)
  approvedGenderFilter     // ✨ 'approved' (멤버탭용)
) {
  
  // 성별 필터링 헬퍼 함수
  const filterByGender = (user, filter) => {
    if (filter === 'all') return true;
    if (filter === 'unset') return !user.gender; 
    return user.gender === filter;
  };

  // 크리에이터 회원 필터링 (변경 없음)
  const filteredCreatorUsers = useMemo(() => {
    const callDurations = {};
    callHistory.forEach(call => {
      const calleeId = call.calleeId;
      const duration = call.duration || 0;
      if (!callDurations[calleeId]) {
        callDurations[calleeId] = 0;
      }
      callDurations[calleeId] += duration;
    });

    const creators = usersWithRoles
      .filter(user =>
        user.isCreator &&
        ( 
          user.displayName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(creatorSearchTerm.toLowerCase())
        ) && 
        filterByGender(user, creatorGenderFilter) 
      )
      .map(user => ({
        ...user,
        totalDuration: callDurations[user.uid] || 0,
      }));

    creators.sort((a, b) => b.totalDuration - a.totalDuration);
    
    return creators;
  }, [usersWithRoles, callHistory, creatorSearchTerm, creatorGenderFilter]); 

  // 사용자별 총 충전 코인 합계 (공통 사용)
  const totalChargedCoins = useMemo(() => {
    const totals = {};
    coinHistory.forEach(log => {
      if (log.type === 'charge' || log.type === 'admin_give') {
        if (!totals[log.userId]) {
          totals[log.userId] = 0;
        }
        totals[log.userId] += log.amount;
      }
    });
    return totals;
  }, [coinHistory]);

  // ✨ [수정] '매칭 신청 회원' (대시보드용, 'submitted' 상태)
  const filteredSubmittedUsers = useMemo(() => {
    return usersWithRoles
      .filter(user =>
        !user.isCreator && 
        user.applicationStatus === 'submitted' && // 'submitted' 상태
        ( 
          user.displayName?.toLowerCase().includes(submittedSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(submittedSearchTerm.toLowerCase())
        ) &&
        filterByGender(user, submittedGenderFilter) 
      )
      .map(user => ({ // map은 필요하지만 sort는 대시보드에서 필요 없으므로 제거
        ...user,
        totalCharged: totalChargedCoins[user.uid] || 0,
      }));
  }, [usersWithRoles, totalChargedCoins, submittedSearchTerm, submittedGenderFilter]);
  
  // ✨ [추가] '매칭 승인 회원' (멤버탭용, 'approved' 상태)
  const filteredApprovedUsers = useMemo(() => {
    const approvedUsers = usersWithRoles
      .filter(user =>
        !user.isCreator && 
        user.applicationStatus === 'approved' && // 'approved' 상태
        ( 
          user.displayName?.toLowerCase().includes(approvedSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(approvedSearchTerm.toLowerCase())
        ) &&
        filterByGender(user, approvedGenderFilter) 
      )
      .map(user => ({
        ...user,
        totalCharged: totalChargedCoins[user.uid] || 0,
      }));
      
    approvedUsers.sort((a, b) => b.totalCharged - a.totalCharged);
    return approvedUsers;
  }, [usersWithRoles, totalChargedCoins, approvedSearchTerm, approvedGenderFilter]);

  // ✨ [수정] '일반 회원' (신청 상태가 'approved'도 'submitted'도 아닌 회원)
  const filteredGeneralUsers = useMemo(() => {
    const generalUsers = usersWithRoles
      .filter(user =>
        !user.isCreator && 
        user.applicationStatus !== 'approved' &&  // 'approved'가 아니고
        user.applicationStatus !== 'submitted' && // 'submitted'가 아닌 회원
        ( 
          user.displayName?.toLowerCase().includes(generalSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(generalSearchTerm.toLowerCase())
        ) &&
        filterByGender(user, generalGenderFilter) 
      )
      .map(user => ({
        ...user,
        totalCharged: totalChargedCoins[user.uid] || 0,
      }));
      
    generalUsers.sort((a, b) => b.totalCharged - a.totalCharged);
    return generalUsers;
  }, [usersWithRoles, totalChargedCoins, generalSearchTerm, generalGenderFilter]);

  // ... (filteredCallHistory, filteredCoinHistory는 변경 없음) ...
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
    filteredSubmittedUsers, // ✨ 'submitted'
    filteredApprovedUsers,  // ✨ 'approved'
    filteredGeneralUsers,
    filteredCallHistory,
    filteredCoinHistory,
  };
}