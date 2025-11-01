// components/admin/ApplicantDetailModal.js
'use client';
import React from 'react';
import styles from './Admin.module.css';

// 헬퍼 함수: 성별 포맷팅
const formatGender = (gender) => {
  if (gender === 'male') return '남성';
  if (gender === 'female') return '여성';
  if (gender === 'other') return '기타';
  return '미설정';
};

// 헬퍼 함수: 동의 여부 포맷팅
const formatBoolean = (value) => (value ? '예' : '아니오');

// 헬퍼 함수: 유입 경로 포맷팅
const formatReferral = (referral) => {
  switch (referral) {
    case 'friend': return '지인 추천';
    case 'sns': return 'SNS (인스타그램, 페이스북 등)';
    case 'search': return '검색 (네이버, 구글 등)';
    case 'other': return '기타';
    default: return '미입력';
  }
};

// 상세 항목을 보여주는 내부 컴포넌트
const DetailRow = ({ label, value }) => (
  <div className={styles.settingRow}>
    <label>{label}</label>
    <span style={{ color: 'white', textAlign: 'right' }}>{value || 'N/A'}</span>
  </div>
);

// 긴 텍스트(소개)를 보여주는 내부 컴포넌트
const DetailBox = ({ label, value }) => (
  <div className={styles.detailBox}>
    <label>{label}</label>
    <pre className={styles.detailContent}>{value || 'N/A'}</pre>
  </div>
);

export default function ApplicantDetailModal({ applicant, onClose }) {
  if (!applicant) return null;

  return (
    // 모달 오버레이
    <div className={styles.modalOverlay} onClick={onClose}>
      {/* 모달 컨텐츠 (이벤트 버블링 방지) */}
      <div 
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '600px' }} // UserManagementModal보다 넓게
      >
        <div className={styles.modalHeader}>
          <h2>{applicant.name}님 상세정보</h2>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>
        
        {/* 스크롤 가능한 상세정보 바디 */}
        <div className={styles.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto', gap: '1rem' }}>
          
          {/* 기본 정보 */}
          <div className={styles.gridItem} style={{ padding: '1rem' }}>
            <h4 className={styles.sectionTitle} style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>기본 정보</h4>
            <DetailRow label="이름" value={applicant.name} />
            <DetailRow label="연락처" value={applicant.contact} />
            <DetailRow label="성별" value={formatGender(applicant.gender)} />
            <DetailRow label="출생년도" value={applicant.birthYear} />
          </div>

          {/* 추가 정보 */}
          <div className={styles.gridItem} style={{ padding: '1rem' }}>
            <h4 className={styles.sectionTitle} style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>추가 정보</h4>
            <DetailRow label="거주지역" value={applicant.region} />
            <DetailRow label="키(cm)" value={applicant.height} />
            <DetailRow label="직업" value={applicant.occupation} />
            <DetailRow label="최종학력" value={applicant.education} />
            <DetailRow label="유입경로" value={formatReferral(applicant.referral)} />
          </div>

          {/* 소개 */}
          <div className={styles.gridItem} style={{ padding: '1rem' }}>
            <h4 className={styles.sectionTitle} style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>소개</h4>
            <DetailBox label="신청 이유" value={applicant.reason} />
            <DetailBox label="자신의 매력" value={applicant.charm} />
          </div>
          
          {/* 동의 항목 */}
          <div className={styles.gridItem} style={{ padding: '1rem' }}>
            <h4 className={styles.sectionTitle} style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>동의 항목</h4>
            <DetailRow label="연락 안내 동의" value={formatBoolean(applicant.agreeContact)} />
            <DetailRow label="매칭 검토 동의" value={formatBoolean(applicant.agreeReview)} />
          </div>
        </div>
      </div>
    </div>
  );
}