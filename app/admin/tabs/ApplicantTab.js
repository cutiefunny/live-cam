// app/admin/tabs/ApplicantTab.js
import React from 'react';
import styles from '@/components/admin/Admin.module.css';
import Pagination from '@/components/admin/Pagination';

// MembersTab.js의 헬퍼 함수 재사용
const formatGender = (gender) => {
  if (gender === 'male') return '남성';
  if (gender === 'female') return '여성';
  if (gender === 'other') return '기타';
  return '미설정';
};

const ApplicantTab = ({
  applicants, // 'pending' 상태인 신청자 목록
  pagination,
  searchTerm,
  setSearchTerm,
  genderFilter,
  setGenderFilter,
  onViewDetails, // 상세보기 모달을 열 함수
  onApprove,     // 승인 처리 함수
  onReject,      // 거절 처리 함수
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>매칭 신청자 목록 ({applicants.length})</h2>
        <div className={styles.searchContainer}>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className={styles.searchFilter}
          >
            <option value="all">모든 성별</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
          </select>
          <input
            type="text"
            placeholder="이름 또는 연락처로 검색..."
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
              <th>이름</th>
              <th>성별</th>
              <th>출생년도</th>
              <th>연락처</th>
              <th>신청일</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagination.currentUsers && pagination.currentUsers.length > 0 ? (
              pagination.currentUsers.map((req) => (
                <tr key={req.id}>
                  <td>{req.name}</td>
                  <td>{formatGender(req.gender)}</td>
                  <td>{req.birthYear}</td>
                  <td>{req.contact}</td>
                  {/* Firestore Timestamp 객체를 날짜 문자열로 변환 */}
                  <td>{req.createdAt?.toDate().toLocaleString() ?? 'N/A'}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      {/* 상세보기 버튼 (파란색 계열) */}
                      <button 
                        onClick={() => onViewDetails(req)} 
                        className={styles.actionButton} 
                        style={{ borderColor: '#2563eb', color: '#a5b4fc', width: 'auto' }}
                      >
                        상세보기
                      </button>
                      <button onClick={() => onApprove(req)} className={styles.approveButton}>
                        승인
                      </button>
                      <button onClick={() => onReject(req)} className={styles.rejectButton}>
                        거절
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>
                  대기 중인 신청자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} />
    </div>
  );
};

export default ApplicantTab;