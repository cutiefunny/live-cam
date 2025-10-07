// app/admin/tabs/CoinsTab.js
import React from 'react';
import styles from '@/components/admin/Admin.module.css';

const CoinsTab = ({
  coinHistory,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>코인 변동 내역 ({coinHistory.length})</h2>
        <div className={styles.searchContainer}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.searchFilter}
          >
            <option value="all">전체 타입</option>
            <option value="charge">충전</option>
            <option value="use">사용</option>
            <option value="earn">정산</option>
            <option value="admin_give">관리자 지급</option>
            <option value="admin_take">관리자 회수</option>
          </select>
          <input
            type="text"
            placeholder="이름 또는 이메일로 검색..."
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
              <th>User</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {coinHistory.map((log) => (
              <tr key={log.id}>
                <td>{log.userEmail || log.userName}</td>
                <td>
                  <span className={`${styles.logType} ${styles[log.type]}`}>
                    {log.type.replace('_', ' ')}
                  </span>
                </td>
                <td className={styles[log.type === 'use' || log.type === 'admin_take' ? 'use' : 'charge']}>
                  {log.type.includes('give') || log.type.includes('charge') || log.type.includes('earn') ? '+' : '-'}
                  {log.amount}
                </td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CoinsTab;