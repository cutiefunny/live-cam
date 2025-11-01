// hooks/useFilters.js
import { useMemo } from 'react';

// ✨ [수정] 성별 필터 인수 추가
export function useFilters(
  usersWithRoles,
  callHistory,
  coinHistory,
  applicants, // ✨ [추가]
  creatorSearchTerm,
  generalSearchTerm,
  historySearchTerm,
  historySearchFilter,
  coinHistorySearchTerm,
  coinHistoryFilter,
  applicantSearchTerm, // ✨ [추가]
  creatorGenderFilter, 
  generalGenderFilter, 
  applicantGenderFilter // ✨ [추가]
) {
  
  // ✨ [추가] 성별 필터링 헬퍼 함수
  const filterByGender = (user, filter) => {
    if (filter === 'all') return true;
    if (filter === 'unset') return !user.gender; // gender 필드가 없거나 null, undefined인 경우
    return user.gender === filter;
  };

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

    // 2. 검색어 및 성별 필터링, 통화 시간 데이터 추가
    const creators = usersWithRoles
      .filter(user =>
        user.isCreator &&
        ( // 이름 또는 이메일 검색
          user.displayName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(creatorSearchTerm.toLowerCase())
        ) && 
        filterByGender(user, creatorGenderFilter) // ✨ [추가] 성별 필터 적용
      )
      .map(user => ({
        ...user,
        totalDuration: callDurations[user.uid] || 0,
      }));

    // 3. 총 통화 시간으로 내림차순 정렬
    creators.sort((a, b) => b.totalDuration - a.totalDuration);
    
    return creators;
  }, [usersWithRoles, callHistory, creatorSearchTerm, creatorGenderFilter]); // ✨ [추가] 의존성 배열

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

    // 2. 검색어 및 성별 필터링, 충전 합계 데이터 추가
    const generalUsers = usersWithRoles
      .filter(user =>
        !user.isCreator &&
        ( // 이름 또는 이메일 검색
          user.displayName?.toLowerCase().includes(generalSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(generalSearchTerm.toLowerCase())
        ) &&
        filterByGender(user, generalGenderFilter) // ✨ [추가] 성별 필터 적용
      )
      .map(user => ({
        ...user,
        totalCharged: totalChargedCoins[user.uid] || 0,
      }));
      
    // 3. 총 충전 코인 합계로 내림차순 정렬
    generalUsers.sort((a, b) => b.totalCharged - a.totalCharged);

    return generalUsers;
  }, [usersWithRoles, coinHistory, generalSearchTerm, generalGenderFilter]); // ✨ [추가] 의존성 배열

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

  // ✨ [추가] 신청자 목록 필터링
  const filteredApplicants = useMemo(() => {
    return applicants.filter(applicant => {
      const searchTermLower = applicantSearchTerm.toLowerCase();
      const nameMatch = applicant.name?.toLowerCase().includes(searchTermLower);
      const contactMatch = applicant.contact?.replace(/-/g, '').includes(searchTermLower.replace(/-/g, ''));
      
      const genderMatch = filterByGender(applicant, applicantGenderFilter);

      return (nameMatch || contactMatch) && genderMatch;
    });
  }, [applicants, applicantSearchTerm, applicantGenderFilter]);

  return {
    filteredCreatorUsers,
    filteredGeneralUsers,
    filteredCallHistory,
    filteredCoinHistory,
    filteredApplicants, // ✨ [추가]
  };
}