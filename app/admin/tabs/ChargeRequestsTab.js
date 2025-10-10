// app/admin/tabs/ChargeRequestsTab.js
import React from 'react';
import styles from '@/components/admin/Admin.module.css';

const ChargeRequestsTab = ({ requests, onApprove, onReject }) => {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>코인 충전 요청 ({requests.length})</h2>
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
            {requests.length > 0 ? (
              requests.map((req) => (
                <tr key={req.requestId}>
                  <td>{req.userName} ({req.userEmail})</td>
                  <td>💰 {req.amount}</td>
                  <td>{req.price}</td>
                  {/* ✨ [수정] Firestore Timestamp 객체를 날짜 문자열로 변환 */}
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
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center' }}>
                  대기 중인 충전 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChargeRequestsTab;