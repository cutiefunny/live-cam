// app/admin/tabs/DashboardTab.js
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import styles from '@/components/admin/Admin.module.css';
import Pagination from '@/components/admin/Pagination';

// Chart.js 모듈 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const formatTimeAgo = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return `${diffInSeconds}초 전`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}분 전`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}시간 전`;
};

// ✨ [추가] 성별 포맷팅 헬퍼
const formatGender = (gender) => {
  if (gender === 'male') return '남성';
  if (gender === 'female') return '여성';
  if (gender === 'other') return '기타';
  return '미설정';
};


const DashboardTab = ({ 
  onlineCreators, 
  dashboardData, 
  onlineCreatorsPagination,
  newUsersPagination,
  chargeRequestsPagination,
  onApprove,
  onReject,
  // ✨ [추가] 매칭 신청 회원 관련 props
  applicantRequests,
  applicantRequestsPagination,
  onApproveApplicant,
  onRejectApplicant,
  onViewApplicantDetails,
}) => {

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e5e7eb' }
      },
      title: {
        display: true,
        text: '최근 1주일 코인 사용량',
        color: '#f9fafb',
        font: { size: 16 }
      },
    },
    scales: {
        x: { ticks: { color: '#9ca3af' } },
        y: { ticks: { color: '#9ca3af' } }
    }
  };

  return (
    <>
      {/* ✨ [신규] 매칭 신청 회원 섹션 */}
      {applicantRequests && applicantRequests.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            매칭 신청 회원 ({applicantRequests.length})
          </h2>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>성별</th>
                  <th>출생년도</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applicantRequests.map((req) => (
                  <tr key={req.uid}>
                    <td>{req.displayName} ({req.email})</td>
                    <td>{formatGender(req.gender)}</td>
                    <td>{req.birthYear}</td>
                    {/* users 문서의 applicationTimestamp 필드 사용 */}
                    <td>{req.applicationTimestamp?.toDate().toLocaleString() ?? 'N/A'}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button 
                          onClick={() => onViewApplicantDetails(req)} 
                          className={styles.actionButton} 
                          style={{ borderColor: '#2563eb', color: '#a5b4fc', width: 'auto' }}
                        >
                          상세보기
                        </button>
                        <button onClick={() => onApproveApplicant(req)} className={styles.approveButton}>
                          승인
                        </button>
                        <button onClick={() => onRejectApplicant(req)} className={styles.rejectButton}>
                          거절
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...applicantRequestsPagination} />
        </div>
      )}

      {/* --- 기존 코인 충전 요청 섹션 --- */}
      {dashboardData.chargeRequests && dashboardData.chargeRequests.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            코인 충전 요청 ({dashboardData.chargeRequests.length})
          </h2>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Price</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.chargeRequests.map((req) => (
                  <tr key={req.requestId}>
                    <td>{req.userName} ({req.userEmail})</td>
                    <td>💰 {req.amount}</td>
                    <td>{req.price}</td>
                    {/* charge_requests 문서의 timestamp 필드 사용 */}
                    <td>{req.timestamp?.toDate().toLocaleString() ?? 'N/A'}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button onClick={() => onApprove(req)} className={styles.approveButton}>
                          승인
                        </button>
                        <button onClick={() => onReject(req)} className={styles.rejectButton}>
                          거절
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...chargeRequestsPagination} />
        </div>
      )}

      {/* --- 기존 온라인 크리에이터 섹션 --- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>온라인 크리에이터 ({onlineCreators.length})</h2>
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th>Avatar</th>
                    <th>Display Name</th>
                    <th>UID</th>
                    <th>Status</th>
                </tr>
                </thead>
                <tbody>
                {onlineCreators.map((creator) => (
                    <tr key={creator.uid}>
                    <td><img src={creator.photoURL} alt={creator.displayName} className={styles.avatar} /></td>
                    <td>{creator.displayName}</td>
                    <td>{creator.uid}</td>
                    <td><span className={`${styles.status} ${styles[creator.status]}`}>{creator.status}</span></td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
        <Pagination {...onlineCreatorsPagination} />
      </div>

      {/* --- 기존 대시보드 그리드 (신규가입/차트) --- */}
      <div className={styles.dashboardGrid}>
        <div className={styles.gridItem}>
            <h3 className={styles.sectionTitle}>신규 가입 회원</h3>
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <tbody>
                        {dashboardData.newUsers.map((user) => (
                            <tr key={user.uid}>
                                <td><img src={user.photoURL || '/images/icon.png'} alt={user.displayName} className={styles.avatar} /></td>
                                <td>{user.displayName || 'N/A'}</td>
                                <td>{formatTimeAgo(user.creationTime)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination {...newUsersPagination} />
        </div>
        <div className={styles.gridItem}>
             <div className={styles.chartContainer}>
                {dashboardData.weeklyCoinStats.labels.length > 0 ? (
                    <Line options={chartOptions} data={dashboardData.weeklyCoinStats} />
                ) : (
                    <p>데이터가 없습니다.</p>
                )}
            </div>
        </div>
      </div>
    </>
  );
};

export default DashboardTab;