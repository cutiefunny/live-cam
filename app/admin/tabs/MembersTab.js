// app/admin/tabs/MembersTab.js
import React from 'react';
import styles from '@/components/admin/Admin.module.css';

const MembersTab = ({
  creatorUsers,
  generalUsers,
  creatorSearchTerm,
  setCreatorSearchTerm,
  generalSearchTerm,
  setGeneralSearchTerm,
  onUserClick,
  pagination
}) => {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>크리에이터 회원 목록 ({creatorUsers.length})</h2>
          <input
            type="text"
            placeholder="이름 또는 이메일로 검색..."
            value={creatorSearchTerm}
            onChange={(e) => setCreatorSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>Coins</th>
              </tr>
            </thead>
            <tbody>
              {creatorUsers.map((member) => (
                <tr key={member.uid} onClick={() => onUserClick(member)} className={styles.clickableRow}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>{member.coins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>일반 회원 목록 ({generalUsers.length})</h2>
          <input
            type="text"
            placeholder="이름 또는 이메일로 검색..."
            value={generalSearchTerm}
            onChange={(e) => setGeneralSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>Coins</th>
              </tr>
            </thead>
            <tbody>
              {pagination.currentGeneralUsers.map((member) => (
                <tr key={member.uid} onClick={() => onUserClick(member)} className={styles.clickableRow}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>{member.coins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <button onClick={() => pagination.paginate(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}>
            &laquo; Prev
          </button>
          <span> Page {pagination.currentPage} of {pagination.totalPages} </span>
          <button onClick={() => pagination.paginate(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages || pagination.totalPages === 0}>
            Next &raquo;
          </button>
        </div>
      </div>
    </>
  );
};

export default MembersTab;