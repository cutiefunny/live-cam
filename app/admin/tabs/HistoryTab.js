// app/admin/tabs/HistoryTab.js
import React from 'react';
import { formatDuration } from '@/lib/utils';
import styles from '@/components/admin/Admin.module.css';

const HistoryTab = ({
  callHistory,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>통화 내역 ({callHistory.length})</h2>
        <div className={styles.searchContainer}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.searchFilter}
          >
            <option value="all">전체</option>
            <option value="caller">발신자</option>
            <option value="callee">수신자</option>
          </select>
          <input
            type="text"
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Caller</th>
              <th>Callee</th>
              <th>Time</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {callHistory.map((call) => (
              <tr key={call.id}>
                <td>{call.callerName}</td>
                <td>{call.calleeName}</td>
                {/* ✨ [수정] Firestore Timestamp 객체를 날짜 문자열로 변환 */}
                <td>{call.timestamp?.toDate().toLocaleString() ?? 'N/A'}</td>
                <td>{formatDuration(call.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTab;