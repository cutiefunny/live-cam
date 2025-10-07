// hooks/useFilters.js
import { useMemo } from 'react';

export function useFilters(usersWithRoles, callHistory, coinHistory, creatorSearchTerm, generalSearchTerm, historySearchTerm, historySearchFilter, coinHistorySearchTerm, coinHistoryFilter) {
  const filteredCreatorUsers = useMemo(() => {
    return usersWithRoles.filter(user =>
      user.isCreator &&
      (
        user.displayName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(creatorSearchTerm.toLowerCase())
      )
    );
  }, [usersWithRoles, creatorSearchTerm]);

  const filteredGeneralUsers = useMemo(() => {
    return usersWithRoles.filter(user =>
      !user.isCreator &&
      (
        user.displayName?.toLowerCase().includes(generalSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(generalSearchTerm.toLowerCase())
      )
    );
  }, [usersWithRoles, generalSearchTerm]);

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