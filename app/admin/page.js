// app/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { ref, update, runTransaction, push } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '@/hooks/useAdminData';
import useAppStore from '@/store/useAppStore';
import UserManagementModal from '@/components/admin/UserManagementModal';
import { formatDuration } from '@/lib/utils';
import styles from '@/components/admin/Admin.module.css';

export default function AdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { 
    onlineCreators, 
    callHistory, 
    usersWithRoles, 
    setUsersWithRoles,
    coinHistory,
    isLoading: isAdminDataLoading 
  } = useAdminData();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generalSearchTerm, setGeneralSearchTerm] = useState('');
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySearchFilter, setHistorySearchFilter] = useState('all');
  const [coinHistorySearchTerm, setCoinHistorySearchTerm] = useState('');
  const [coinHistoryFilter, setCoinHistoryFilter] = useState('all');

  const [activeTab, setActiveTab] = useState('dashboard'); 

  const showToast = useAppStore((state) => state.showToast);
  const usersPerPage = 10;
  
  useEffect(() => {
    setCurrentPage(1);
  }, [generalSearchTerm, creatorSearchTerm]);

  const handleToggleCreator = async (member) => {
    const userRef = ref(database, `users/${member.uid}`);
    const newIsCreatorStatus = !member.isCreator;
    await update(userRef, { isCreator: newIsCreatorStatus });
    
    const updatedUser = { ...member, isCreator: newIsCreatorStatus };
    setUsersWithRoles(prevUsers => prevUsers.map(u => (u.uid === member.uid ? updatedUser : u)));
    setSelectedUser(updatedUser);
    showToast(`${member.displayName || '해당 유저'}님의 역할이 변경되었습니다.`, 'success');
  };
  
  const handleUpdateCoins = async (member, amount) => {
    const userRef = ref(database, `users/${member.uid}`);
    let finalAmount = 0;
    await runTransaction(userRef, (userData) => {
      if (userData) {
        const currentCoins = userData.coins || 0;
        if (currentCoins + amount < 0) {
          finalAmount = currentCoins;
          return; 
        }
        userData.coins = currentCoins + amount;
        finalAmount = userData.coins;
      } else {
        if (amount < 0) {
            finalAmount = 0;
            return { ...member, coins: 0 };
        }
        finalAmount = amount;
        return { ...member, coins: amount };
      }
      return userData;
    });
    
    if ((member.coins || 0) + amount < 0) {
        showToast('코인을 0개 미만으로 회수할 수 없습니다.', 'error');
        return;
    }

    const coinHistoryRef = ref(database, 'coin_history');
    const historyLog = {
      userId: member.uid,
      userName: member.displayName || member.email,
      type: amount > 0 ? 'admin_give' : 'admin_take',
      amount: Math.abs(amount),
      timestamp: Date.now(),
      description: `관리자(${user.email})가 ${amount > 0 ? '지급' : '회수'}`
    };
    await push(coinHistoryRef, historyLog);

    const updatedUser = { ...member, coins: finalAmount };
    setUsersWithRoles(prevUsers => prevUsers.map(u => (u.uid === member.uid ? updatedUser : u)));
    setSelectedUser(updatedUser);
    showToast(`${member.displayName || '해당 유저'}님의 코인이 ${finalAmount}개로 변경되었습니다.`, 'success');
  };

  const filteredCreatorUsers = usersWithRoles.filter(user => 
    user.isCreator &&
    (
      user.displayName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(creatorSearchTerm.toLowerCase())
    )
  );

  const filteredGeneralUsers = usersWithRoles.filter(user => 
    !user.isCreator &&
    (
      user.displayName?.toLowerCase().includes(generalSearchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(generalSearchTerm.toLowerCase())
    )
  );
  
  const filteredCallHistory = callHistory.filter(call => {
    const searchTermLower = historySearchTerm.toLowerCase();
    if (!searchTermLower) return true;

    const callerMatch = call.callerName?.toLowerCase().includes(searchTermLower);
    const calleeMatch = call.calleeName?.toLowerCase().includes(searchTermLower);

    switch (historySearchFilter) {
      case 'caller':
        return callerMatch;
      case 'callee':
        return calleeMatch;
      default: // 'all'
        return callerMatch || calleeMatch;
    }
  });

  const filteredCoinHistory = coinHistory.filter(log => {
    const typeMatch = coinHistoryFilter === 'all' || log.type === coinHistoryFilter;
    const userMatch = log.userName?.toLowerCase().includes(coinHistorySearchTerm.toLowerCase());
    return typeMatch && userMatch;
  });

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentGeneralUsers = filteredGeneralUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredGeneralUsers.length / usersPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (isAuthLoading || isAdminDataLoading) {
    return <div className={styles.container}>Loading...</div>;
  }
  
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
      {isModalOpen && (
        <UserManagementModal 
          user={selectedUser}
          onClose={() => setIsModalOpen(false)}
          onUpdateRole={handleToggleCreator}
          onUpdateCoins={handleUpdateCoins}
        />
      )}

      <h1 className={styles.title}>관리자 페이지</h1>

      <div className={styles.tabNav}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'dashboard' ? styles.active : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          대시보드
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'members' ? styles.active : ''}`}
          onClick={() => setActiveTab('members')}
        >
          회원 목록
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          통화 내역
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'coins' ? styles.active : ''}`}
          onClick={() => setActiveTab('coins')}
        >
          코인 내역
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'dashboard' && (
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
        )}

        {activeTab === 'members' && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>크리에이터 회원 목록 ({filteredCreatorUsers.length})</h2>
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
                    {filteredCreatorUsers.map((member) => (
                      <tr key={member.uid} onClick={() => { setSelectedUser(member); setIsModalOpen(true); }} className={styles.clickableRow}>
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
                  <h2 className={styles.sectionTitle}>일반 회원 목록 ({filteredGeneralUsers.length})</h2>
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
                    {currentGeneralUsers.map((member) => (
                        <tr key={member.uid} onClick={() => { setSelectedUser(member); setIsModalOpen(true); }} className={styles.clickableRow}>
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
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                    &laquo; Prev
                </button>
                <span> Page {currentPage} of {totalPages} </span>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}>
                    Next &raquo;
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>통화 내역 ({filteredCallHistory.length})</h2>
                <div className={styles.searchContainer}>
                    <select
                        value={historySearchFilter}
                        onChange={(e) => setHistorySearchFilter(e.target.value)}
                        className={styles.searchFilter}
                    >
                        <option value="all">전체</option>
                        <option value="caller">발신자</option>
                        <option value="callee">수신자</option>
                    </select>
                    <input 
                        type="text"
                        placeholder="이름으로 검색..."
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Caller</th>
                    <th>Callee</th>
                    <th>Time</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCallHistory.map((call) => (
                    <tr key={call.id}>
                      <td>{call.callerName}</td>
                      <td>{call.calleeName}</td>
                      <td>{new Date(call.timestamp).toLocaleString()}</td>
                      <td>{formatDuration(call.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'coins' && (
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>코인 변동 내역 ({filteredCoinHistory.length})</h2>
                    <div className={styles.searchContainer}>
                        <select
                            value={coinHistoryFilter}
                            onChange={(e) => setCoinHistoryFilter(e.target.value)}
                            className={styles.searchFilter}
                        >
                            <option value="all">전체 타입</option>
                            <option value="admin_give">지급</option>
                            <option value="admin_take">회수</option>
                        </select>
                        <input 
                            type="text"
                            placeholder="사용자 이름으로 검색..."
                            value={coinHistorySearchTerm}
                            onChange={(e) => setCoinHistorySearchTerm(e.target.value)}
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
                            {filteredCoinHistory.map((log) => (
                                <tr key={log.id}>
                                    <td>{log.userName}</td>
                                    <td>
                                        <span className={`${styles.logType} ${styles[log.type]}`}>
                                            {log.type.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className={styles[log.type]}>
                                        {log.type.includes('give') || log.type.includes('charge') ? '+' : '-'}
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
        )}
      </div>
    </div>
  );
}