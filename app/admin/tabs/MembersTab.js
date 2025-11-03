// app/admin/tabs/MembersTab.js
import React from 'react';
import styles from '@/components/admin/Admin.module.css';
import Pagination from '@/components/admin/Pagination';
import { formatDuration } from '@/lib/utils';

const formatGender = (gender) => {
  if (gender === 'male') return '남성';
  if (gender === 'female') return '여성';
  return '미설정';
};

const MembersTab = ({
  creatorUsers,
  generalUsers,
  totalGeneralUsers,
  creatorSearchTerm,
  setCreatorSearchTerm,
  generalSearchTerm,
  setGeneralSearchTerm,
  onUserClick,
  pagination, 
  creatorGenderFilter,
  setCreatorGenderFilter,
  generalGenderFilter,
  setGeneralGenderFilter,
  
  // 'applicant' props (이제 'approved' 사용자를 의미함)
  applicantUsers,
  totalApplicantUsers,
  applicantSearchTerm,
  setApplicantSearchTerm,
  applicantGenderFilter,
  setApplicantGenderFilter,
  applicantPagination,
  
  onCancelApproval, // ✨ [추가] 승인 취소 핸들러
}) => {
  return (
    <>
      {/* --- 1. 크리에이터 회원 목록 (변경 없음) --- */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>크리에이터 회원 목록 ({creatorUsers.length})</h2>
          <div className={styles.searchContainer}>
            <select
              value={creatorGenderFilter}
              onChange={(e) => setCreatorGenderFilter(e.target.value)}
              className={styles.searchFilter}
            >
              <option value="all">모든 성별</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="unset">미설정</option>
            </select>
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={creatorSearchTerm}
              onChange={(e) => setCreatorSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>성별</th> 
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
                  <td>{formatGender(member.gender)}</td>
                  <td>{member.coins || 0}</td>
                  <td>{formatDuration(member.totalDuration)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>크리에이터 회원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>매칭 승인 회원 목록 ({totalApplicantUsers.length})</h2>
          <div className={styles.searchContainer}>
            <select
              value={applicantGenderFilter}
              onChange={(e) => setApplicantGenderFilter(e.target.value)}
              className={styles.searchFilter}
            >
              <option value="all">모든 성별</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="unset">미설정</option>
            </select>
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={applicantSearchTerm}
              onChange={(e) => setApplicantSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>성별</th>
                <th>Coins</th>
                <th>Charged</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applicantUsers.length > 0 ? applicantUsers.map((member) => (
                // ✨ [수정] 행 전체 클릭 시 모달이 열리도록 유지
                <tr key={member.uid} onClick={() => onUserClick(member)} className={styles.clickableRow}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>{formatGender(member.gender)}</td>
                  <td>{member.coins || 0}</td>
                  <td>{member.totalCharged || 0}</td>
                  <td>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // 행 클릭(모달 열기) 방지
                        onCancelApproval(member);
                      }} 
                      className={styles.rejectButton} // 거절 버튼(빨간색) 스타일 재사용
                    >
                      승인 취소
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center' }}>매칭 승인 회원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...applicantPagination} />
      </div>

      {/* --- 3. 일반 회원 목록 (변경 없음) --- */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>일반 회원 목록 ({totalGeneralUsers.length})</h2>
          <div className={styles.searchContainer}>
            <select
              value={generalGenderFilter}
              onChange={(e) => setGeneralGenderFilter(e.target.value)}
              className={styles.searchFilter}
            >
              <option value="all">모든 성별</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="unset">미설정</option>
            </select>
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={generalSearchTerm}
              onChange={(e) => setGeneralSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>성별</th>
                <th>Coins</th>
                <th>Charged</th>
              </tr>
            </thead>
            <tbody>
              {generalUsers.length > 0 ? generalUsers.map((member) => (
                <tr key={member.uid} onClick={() => onUserClick(member)} className={styles.clickableRow}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>{formatGender(member.gender)}</td>
                  <td>{member.coins || 0}</td>
                  <td>{member.totalCharged || 0}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>일반 회원이 없습니다.</td>
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