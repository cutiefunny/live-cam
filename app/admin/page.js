// app/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { ref, onValue, off, update, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import styles from './Admin.module.css';

// ✨ [추가] 밀리초를 '분:초' 형식으로 변환하는 함수
const formatDuration = (ms) => {
  if (!ms || ms < 1000) return '< 1s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

export default function AdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { users: allAuthUsers, isLoading: isUsersLoading } = useUsers();
  const [onlineCreators, setOnlineCreators] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [usersWithRoles, setUsersWithRoles] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    const creatorsRef = ref(database, 'creators');
    const listener = onValue(creatorsRef, (snapshot) => {
      const data = snapshot.val();
      const creatorList = data ? Object.values(data) : [];
      setOnlineCreators(creatorList);
    });
    return () => off(creatorsRef, 'value', listener);
  }, []);

  useEffect(() => {
    const historyRef = ref(database, 'call_history');
    const listener = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      const historyList = [];
      if (data) {
        for (const key in data) {
          historyList.push({ id: key, ...data[key] });
        }
      }
      historyList.sort((a, b) => b.timestamp - a.timestamp);
      setCallHistory(historyList);
    });
    return () => off(historyRef, 'value', listener);
  }, []);

  useEffect(() => {
    if (isUsersLoading || allAuthUsers.length === 0) return;
    const usersRef = ref(database, 'users');
    get(usersRef).then((snapshot) => {
      const usersFromDB = snapshot.val() || {};
      const mergedUsers = allAuthUsers.map(authUser => ({
        ...authUser,
        isCreator: usersFromDB[authUser.uid]?.isCreator || false,
        lastLogin: usersFromDB[authUser.uid]?.lastLogin || null,
      }));
      setUsersWithRoles(mergedUsers);
    });
  }, [allAuthUsers, isUsersLoading]);

  const handleToggleCreator = async (member) => {
    const userRef = ref(database, `users/${member.uid}`);
    const newIsCreatorStatus = !member.isCreator;
    await update(userRef, { isCreator: newIsCreatorStatus });
    setUsersWithRoles(prevUsers => 
      prevUsers.map(u => 
        u.uid === member.uid ? { ...u, isCreator: newIsCreatorStatus } : u
      )
    );
  };

  if (isAuthLoading || isUsersLoading) {
    return <div className={styles.container}>Loading...</div>;
  }
  
  const creatorUsers = usersWithRoles.filter(user => user.isCreator);
  const generalUsers = usersWithRoles.filter(user => !user.isCreator);
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentGeneralUsers = generalUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(generalUsers.length / usersPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (!user || user.email !== 'cutiefunny@gmail.com') {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>관리자 페이지</h1>

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

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>크리에이터 회원 목록 ({creatorUsers.length})</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {creatorUsers.map((member) => (
                <tr key={member.uid}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>
                    <button onClick={() => handleToggleCreator(member)} className={styles.actionButton}>
                      일반 회원으로 변경
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>일반 회원 목록 ({generalUsers.length})</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentGeneralUsers.map((member) => (
                <tr key={member.uid}>
                  <td><img src={member.photoURL || '/images/icon.png'} alt={member.displayName} className={styles.avatar} /></td>
                  <td>{member.displayName || 'N/A'}</td>
                  <td>{member.email}</td>
                  <td>
                    <button onClick={() => handleToggleCreator(member)} className={styles.actionButton}>
                      크리에이터로 지정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
            &laquo; Prev
          </button>
          <span> Page {currentPage} of {totalPages} </span>
          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}>
            Next &raquo;
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>통화 내역 ({callHistory.length})</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Caller</th>
                <th>Callee</th>
                <th>Time</th>
                {/* ✨ [수정] '통화 시간' 열 추가 */}
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {callHistory.map((call) => (
                <tr key={call.id}>
                  <td>{call.callerName}</td>
                  <td>{call.calleeName}</td>
                  <td>{new Date(call.timestamp).toLocaleString()}</td>
                  {/* ✨ [수정] 통화 시간 표시 */}
                  <td>{formatDuration(call.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}