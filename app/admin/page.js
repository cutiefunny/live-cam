// app/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { ref, update, runTransaction, push, get, set, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '@/hooks/useAdminData';
import useAppStore from '@/store/useAppStore';
import { useFilters } from '@/hooks/useFilters';
import { usePagination } from '@/hooks/usePagination';
import UserManagementModal from '@/components/admin/UserManagementModal';
import DashboardTab from './tabs/DashboardTab';
import MembersTab from './tabs/MembersTab';
import HistoryTab from './tabs/HistoryTab';
import CoinsTab from './tabs/CoinsTab';
import SettingsTab from './tabs/SettingsTab';
import styles from '@/components/admin/Admin.module.css';

export default function AdminPage() {
  const { user } = useAuth();
  const {
    onlineCreators,
    callHistory,
    usersWithRoles,
    setUsersWithRoles,
    coinHistory,
    dashboardData,
    isLoading: isAdminDataLoading,
  } = useAdminData();

  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generalSearchTerm, setGeneralSearchTerm] = useState('');
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySearchFilter, setHistorySearchFilter] = useState('all');
  const [coinHistorySearchTerm, setCoinHistorySearchTerm] = useState('');
  const [coinHistoryFilter, setCoinHistoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appSettings, setAppSettings] = useState(null);

  const showToast = useAppStore((state) => state.showToast);

  const {
    filteredCreatorUsers,
    filteredGeneralUsers,
    filteredCallHistory,
    filteredCoinHistory,
  } = useFilters(
    usersWithRoles,
    callHistory,
    coinHistory,
    creatorSearchTerm,
    generalSearchTerm,
    historySearchTerm,
    historySearchFilter,
    coinHistorySearchTerm,
    coinHistoryFilter
  );

  const generalUsersPagination = usePagination(filteredGeneralUsers, 10);
  const onlineCreatorsPagination = usePagination(onlineCreators, 5);
  const newUsersPagination = usePagination(dashboardData.newUsers, 5);
  const chargeRequestsPagination = usePagination(
    dashboardData.chargeRequests,
    5
  );

  useEffect(() => {
    const settingsRef = ref(database, 'settings');
    get(settingsRef).then((snapshot) => {
      if (snapshot.exists()) {
        setAppSettings(snapshot.val());
      } else {
        setAppSettings({
          costPerMinute: 10,
          creatorShareRate: 90,
          costToStart: 0,
        });
      }
    });
  }, []);

  useEffect(() => {
    generalUsersPagination.setCurrentPage(1);
  }, [generalSearchTerm, creatorSearchTerm, generalUsersPagination.setCurrentPage]);

  const handleSaveSettings = async (newSettings) => {
    if (
      newSettings.costPerMinute < 1 ||
      newSettings.creatorShareRate < 0 ||
      newSettings.creatorShareRate > 100 ||
      newSettings.costToStart < 0
    ) {
      showToast('유효하지 않은 값입니다.', 'error');
      return;
    }
    const settingsRef = ref(database, 'settings');
    await set(settingsRef, newSettings);
    setAppSettings(newSettings);
    showToast('설정이 성공적으로 저장되었습니다.', 'success');
  };

  const handleToggleCreator = async (member) => {
    const userRef = ref(database, `users/${member.uid}`);
    const newIsCreatorStatus = !member.isCreator;
    await update(userRef, { isCreator: newIsCreatorStatus });

    const updatedUser = { ...member, isCreator: newIsCreatorStatus };
    setUsersWithRoles((prevUsers) =>
      prevUsers.map((u) => (u.uid === member.uid ? updatedUser : u))
    );
    setSelectedUser(updatedUser);
    showToast(
      `${member.displayName || '해당 유저'}님의 역할이 변경되었습니다.`,
      'success'
    );
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
      userName: member.displayName || 'N/A',
      userEmail: member.email,
      type: amount > 0 ? 'admin_give' : 'admin_take',
      amount: Math.abs(amount),
      timestamp: Date.now(),
      description: `관리자(${user?.email || 'Public Admin'})가 ${
        amount > 0 ? '지급' : '회수'
      }`,
    };
    await push(coinHistoryRef, historyLog);

    const updatedUser = { ...member, coins: finalAmount };
    setUsersWithRoles((prevUsers) =>
      prevUsers.map((u) => (u.uid === member.uid ? updatedUser : u))
    );
    setSelectedUser(updatedUser);
    showToast(
      `${member.displayName || '해당 유저'}님의 코인이 ${finalAmount}개로 변경되었습니다.`,
      'success'
    );
  };

  const handleApproveRequest = async (request) => {
    const { requestId, userId, amount, userName, userEmail } = request;
    const userCoinRef = ref(database, `users/${userId}/coins`);

    try {
      await runTransaction(userCoinRef, (currentCoins) => (currentCoins || 0) + amount);

      const coinHistoryRef = ref(database, 'coin_history');
      await push(coinHistoryRef, {
        userId: userId,
        userName: userName,
        userEmail: userEmail,
        type: 'charge',
        amount: amount,
        timestamp: Date.now(),
        description: '관리자 승인 충전',
      });

      const requestRef = ref(database, `charge_requests/${requestId}`);
      await update(requestRef, { status: 'approved' });

      showToast(`${userName}님의 ${amount}코인 충전을 승인했습니다.`, 'success');
    } catch (error) {
      showToast('충전 승인 중 오류가 발생했습니다.', 'error');
      console.error(error);
    }
  };

  const handleRejectRequest = async (request) => {
    const { requestId, userName, amount } = request;
    const requestRef = ref(database, `charge_requests/${requestId}`);
    try {
      await update(requestRef, { status: 'rejected' });
      showToast(
        `${userName}님의 ${amount}코인 충전 요청을 거절했습니다.`,
        'info'
      );
    } catch (error) {
      showToast('요청 거절 중 오류가 발생했습니다.', 'error');
      console.error(error);
    }
  };

  if (isAdminDataLoading || !appSettings) {
    return <div className={styles.container}>Loading...</div>;
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

      <div className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${
            activeTab === 'dashboard' ? styles.active : ''
          }`}
          onClick={() => setActiveTab('dashboard')}
        >
          대시보드
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === 'members' ? styles.active : ''
          }`}
          onClick={() => setActiveTab('members')}
        >
          회원 목록
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === 'history' ? styles.active : ''
          }`}
          onClick={() => setActiveTab('history')}
        >
          통화 내역
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === 'coins' ? styles.active : ''
          }`}
          onClick={() => setActiveTab('coins')}
        >
          코인 내역
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === 'settings' ? styles.active : ''
          }`}
          onClick={() => setActiveTab('settings')}
        >
          설정
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            onlineCreators={onlineCreatorsPagination.currentUsers}
            onlineCreatorsPagination={onlineCreatorsPagination}
            dashboardData={{
              ...dashboardData,
              newUsers: newUsersPagination.currentUsers,
              chargeRequests: chargeRequestsPagination.currentUsers,
            }}
            newUsersPagination={newUsersPagination}
            chargeRequestsPagination={chargeRequestsPagination}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
          />
        )}

        {activeTab === 'members' && (
          <MembersTab
            creatorUsers={filteredCreatorUsers}
            generalUsers={filteredGeneralUsers}
            creatorSearchTerm={creatorSearchTerm}
            setCreatorSearchTerm={setCreatorSearchTerm}
            generalSearchTerm={generalSearchTerm}
            setGeneralSearchTerm={setGeneralSearchTerm}
            onUserClick={(user) => {
              setSelectedUser(user);
              setIsModalOpen(true);
            }}
            pagination={generalUsersPagination}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            callHistory={filteredCallHistory}
            searchTerm={historySearchTerm}
            setSearchTerm={setHistorySearchTerm}
            filter={historySearchFilter}
            setFilter={setHistorySearchFilter}
          />
        )}

        {activeTab === 'coins' && (
          <CoinsTab
            coinHistory={filteredCoinHistory}
            searchTerm={coinHistorySearchTerm}
            setSearchTerm={setCoinHistorySearchTerm}
            filter={coinHistoryFilter}
            setFilter={setCoinHistoryFilter}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            initialSettings={appSettings}
            onSave={handleSaveSettings}
          />
        )}
      </div>
    </div>
  );
}