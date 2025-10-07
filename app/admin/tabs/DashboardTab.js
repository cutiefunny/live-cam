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

// ✨ [추가] '몇 시간 전' 포맷을 위한 헬퍼 함수
const formatTimeAgo = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        return `${diffInMinutes}분 전`;
    }
    return `${diffInHours}시간 전`;
};


const DashboardTab = ({ onlineCreators, dashboardData }) => {

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
      </div>

      <div className={styles.dashboardGrid}>
        <div className={styles.gridItem}>
            <h3 className={styles.sectionTitle}>신규 가입 회원</h3>
            <div className={styles.tableContainer}>
                {/* ✨ [수정] 신규 가입 회원 테이블 구조 변경 */}
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