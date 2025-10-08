// app/admin/tabs/MembersTab.js
import React from 'react';
import styles from '@/components/admin/Admin.module.css';
import Pagination from '@/components/admin/Pagination';
import { formatDuration } from '@/lib/utils';

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
                <th>Total Duration</th>
              </tr>
            </thead>
            <tbody>
              {creatorUsers.length > 0 ? creatorUsers.map((member) => (
                <tr key={member.uid} onClick={() => onUserClick(member)} className={styles.clickableRow}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>{member.coins}</td>
                  <td>{formatDuration(member.totalDuration)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>크리에이터 회원이 없습니다.</td>
                </tr>
              )}
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
                <th>Charged</th>
              </tr>
            </thead>
            <tbody>
              {pagination.currentUsers.length > 0 ? pagination.currentUsers.map((member) => (
                <tr key={member.uid} onClick={() => onUserClick(member)} className={styles.clickableRow}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>{member.coins}</td>
                  <td>{member.totalCharged || 0}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>일반 회원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </div>
    </>
  );
};

export default MembersTab;