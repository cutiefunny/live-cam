// app/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { doc, updateDoc, runTransaction, addDoc, collection, getDoc, setDoc } from 'firebase/firestore';
import { firestore, storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { processImageForUpload } from '@/lib/imageUtils'; 
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
import ApplicantDetailModal from '@/components/admin/ApplicantDetailModal';

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
    chargeRequests,
    // applicants, // (제거된 상태 유지)
    isLoading: isAdminDataLoading,
  } = useAdminData();

  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generalSearchTerm, setGeneralSearchTerm] = useState('');
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');
  
  // ✨ [수정] 'submitted' (대시보드용) state
  const [applicantSearchTerm, setApplicantSearchTerm] = useState('');
  const [applicantGenderFilter, setApplicantGenderFilter] = useState('all');
  
  // ✨ [추가] 'approved' (멤버탭용) state
  const [approvedSearchTerm, setApprovedSearchTerm] = useState('');
  const [approvedGenderFilter, setApprovedGenderFilter] = useState('all');
  
  const [creatorGenderFilter, setCreatorGenderFilter] = useState('all');
  const [generalGenderFilter, setGeneralGenderFilter] = useState('all');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySearchFilter, setHistorySearchFilter] = useState('all');
  const [coinHistorySearchTerm, setCoinHistorySearchTerm] = useState('');
  const [coinHistoryFilter, setCoinHistoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appSettings, setAppSettings] = useState(null);

  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [isApplicantModalOpen, setIsApplicantModalOpen] = useState(false);

  const showToast = useAppStore((state) => state.showToast);

    const {
    filteredCreatorUsers,
    filteredGeneralUsers,
    filteredCallHistory,
    filteredCoinHistory,
    filteredSubmittedUsers, // ✨ 'submitted' (대시보드용)
    filteredApprovedUsers,  // ✨ 'approved' (멤버탭용)
  } = useFilters(
    usersWithRoles,
    callHistory,
    coinHistory,
    creatorSearchTerm,
    generalSearchTerm,
    historySearchTerm,
    historySearchFilter,
    coinHistorySearchTerm,
    coinHistoryFilter,
    applicantSearchTerm,   // ✨ 'submitted'
    creatorGenderFilter, 
    generalGenderFilter, 
    applicantGenderFilter, // ✨ 'submitted'
    approvedSearchTerm,    // ✨ 'approved'
    approvedGenderFilter     // ✨ 'approved'
  );

  const generalUsersPagination = usePagination(filteredGeneralUsers, 10);
  const onlineCreatorsPagination = usePagination(onlineCreators, 5);
  const newUsersPagination = usePagination(dashboardData.newUsers, 5);
  const chargeRequestsPagination = usePagination(
    chargeRequests,
    5
  );
  
  // ✨ [수정] 'approved' (멤버탭용) 페이지네이션
  const applicantUsersPagination = usePagination(filteredApprovedUsers, 10);
  
  // ✨ [수정] 'submitted' (대시보드용) 페이지네이션
  const dashboardApplicantsPagination = usePagination(filteredSubmittedUsers, 5);

  useEffect(() => {
    getDoc(doc(firestore, 'settings', 'live')).then((snapshot) => {
      if (snapshot.exists()) {
        setAppSettings(snapshot.data());
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
    applicantUsersPagination.setCurrentPage(1);
    dashboardApplicantsPagination.setCurrentPage(1); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    generalSearchTerm, 
    creatorSearchTerm, 
    creatorGenderFilter, 
    generalGenderFilter, 
    applicantSearchTerm,    // ✨ 'submitted'
    applicantGenderFilter,  // ✨ 'submitted'
    approvedSearchTerm,     // ✨ 'approved'
    approvedGenderFilter      // ✨ 'approved'
  ]);

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
    const settingsRef = doc(firestore, 'settings', 'live');
    await setDoc(settingsRef, newSettings);
    setAppSettings(newSettings);
    showToast('설정이 성공적으로 저장되었습니다.', 'success');
  };

  const handleToggleCreator = async (member) => {
    const userRef = doc(firestore, 'users', member.uid);
    const newIsCreatorStatus = !member.isCreator;

    const dataToUpdate = { isCreator: newIsCreatorStatus };
    if (newIsCreatorStatus && typeof member.totalCallTime === 'undefined') {
      dataToUpdate.totalCallTime = 0;
    }
    
    await setDoc(userRef, dataToUpdate, { merge: true });

    const updatedUser = { ...member, ...dataToUpdate };
    setUsersWithRoles((prevUsers) =>
      prevUsers.map((u) => (u.uid === member.uid ? updatedUser : u))
    );
    setSelectedUser(updatedUser);
    showToast(
      `${member.displayName || '해당 유저'}님의 역할이 변경되었습니다.`,
      'success'
    );
  };
  
  const handleUpdateGender = async (member, newGender) => {
    const userRef = doc(firestore, 'users', member.uid);
    const dataToUpdate = {
      gender: newGender === 'unset' ? null : newGender
    };
    
    try {
      await setDoc(userRef, dataToUpdate, { merge: true });

      const updatedUser = { ...member, ...dataToUpdate };
      
      setUsersWithRoles((prevUsers) =>
        prevUsers.map((u) => (u.uid === member.uid ? updatedUser : u))
      );
      setSelectedUser(updatedUser);
      
      showToast(
        `${member.displayName || '해당 유저'}님의 성별이 변경되었습니다.`,
        'success'
      );
    } catch (error) {
      showToast('성별 업데이트에 실패했습니다.', 'error');
      console.error("Failed to update gender:", error);
    }
  };

  const handleUpdateAvatar = async (member, avatarFile) => {
    if (!avatarFile) return;

    showToast('새 프로필 사진을 업로드 중입니다...', 'info');
    try {
        const processedImageBlob = await processImageForUpload(avatarFile, 400); 
        const avatarRef = storageRef(storage, `avatars/${member.uid}`);
        const snapshot = await uploadBytes(avatarRef, processedImageBlob);
        const newPhotoURL = await getDownloadURL(snapshot.ref);

        const userDocRef = doc(firestore, 'users', member.uid);
        await setDoc(userDocRef, { photoURL: newPhotoURL }, { merge: true });

        const updatedUser = { ...member, photoURL: newPhotoURL };
        setUsersWithRoles((prevUsers) =>
            prevUsers.map((u) => (u.uid === member.uid ? updatedUser : u))
        );
        setSelectedUser(updatedUser);
        
        showToast('프로필 사진이 성공적으로 변경되었습니다.', 'success');
    } catch (error) {
        console.error("Failed to update avatar by admin:", error);
        showToast('사진 변경에 실패했습니다.', 'error');
        throw error; 
    }
  };

  const handleUpdateCoins = async (member, amount) => {
    const userRef = doc(firestore, 'users', member.uid);
    let finalAmount = 0;

    try {
      await runTransaction(firestore, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          transaction.set(userRef, { coins: Math.max(0, amount) });
          finalAmount = Math.max(0, amount);
          return;
        }
        
        const currentCoins = userDoc.data().coins || 0;
        if (currentCoins + amount < 0) {
          throw new Error('코인을 0개 미만으로 회수할 수 없습니다.');
        }
        finalAmount = currentCoins + amount;
        transaction.update(userRef, { coins: finalAmount });
      });

      const coinHistoryRef = collection(firestore, 'coin_history');
      await addDoc(coinHistoryRef, {
        userId: member.uid,
        userName: member.displayName || 'N/A',
        userEmail: member.email,
        type: amount > 0 ? 'admin_give' : 'admin_take',
        amount: Math.abs(amount),
        timestamp: new Date(),
        description: `관리자(${user?.email || 'Public Admin'})가 ${
          amount > 0 ? '지급' : '회수'
        }`,
      });

      const updatedUser = { ...member, coins: finalAmount };
      setUsersWithRoles((prevUsers) =>
        prevUsers.map((u) => (u.uid === member.uid ? updatedUser : u))
      );
      setSelectedUser(updatedUser);
      showToast(
        `${member.displayName || '해당 유저'}님의 코인이 ${finalAmount}개로 변경되었습니다.`,
        'success'
      );

    } catch (error) {
       showToast(error.message, 'error');
       console.error("Failed to update coins:", error);
    }
  };

  const handleApproveRequest = async (request) => {
    const { requestId, userId, amount, userName, userEmail } = request;
    const userCoinRef = doc(firestore, 'users', userId);
    const requestRef = doc(firestore, 'charge_requests', requestId);

    try {
      await runTransaction(firestore, async (transaction) => {
        const userDoc = await transaction.get(userCoinRef);
        const currentCoins = userDoc.exists() ? userDoc.data().coins || 0 : 0;
        
        if (userDoc.exists()) {
          transaction.update(userCoinRef, { coins: currentCoins + amount });
        } else {
          transaction.set(userDocRef, { 
            uid: userId,
            displayName: userName,
            email: userEmail,
            coins: amount 
          }, { merge: true });
        }
        
        transaction.update(requestRef, { status: 'approved' });
      });

      await addDoc(collection(firestore, 'coin_history'), {
        userId: userId,
        userName: userName,
        userEmail: userEmail,
        type: 'charge',
        amount: amount,
        timestamp: new Date(),
        description: '관리자 승인 충전',
      });

      showToast(`${userName}님의 ${amount}코인 충전을 승인했습니다.`, 'success');
    } catch (error) {
      showToast('충전 승인 중 오류가 발생했습니다.', 'error');
      console.error(error);
    }
  };

  const handleRejectRequest = async (request) => {
    const { requestId, userName, amount } = request;
    const requestRef = doc(firestore, 'charge_requests', requestId);
    try {
      await updateDoc(requestRef, { status: 'rejected' });
      showToast(
        `${userName}님의 ${amount}코인 충전 요청을 거절했습니다.`,
        'info'
      );
    } catch (error) {
      showToast('요청 거절 중 오류가 발생했습니다.', 'error');
      console.error(error);
    }
  };

  const handleViewApplicantDetails = (applicant) => {
    setSelectedApplicant(applicant);
    setIsApplicantModalOpen(true);
  };

  const handleApproveApplicant = async (applicant) => {
    const userRef = doc(firestore, 'users', applicant.uid);
    try {
      await updateDoc(userRef, { applicationStatus: 'approved' });
      showToast(`${applicant.displayName}님의 신청을 승인했습니다.`, 'success');
    } catch (error) {
      showToast('승인 처리에 실패했습니다.', 'error');
      console.error(error);
    }
  };

  const handleRejectApplicant = async (applicant) => {
    const userRef = doc(firestore, 'users', applicant.uid);
    try {
      await updateDoc(userRef, { applicationStatus: 'rejected' });
      showToast(`${applicant.displayName}님의 신청을 거절했습니다.`, 'info');
    } catch (error) {
      showToast('거절 처리에 실패했습니다.', 'error');
      console.error(error);
    }
  };
  
  // ✨ [추가] 승인 취소 핸들러
  const handleCancelApproval = async (applicant) => {
    const userRef = doc(firestore, 'users', applicant.uid);
    try {
      // 'submitted'로 되돌려 대시보드의 "매칭 신청" 목록으로 이동
      await updateDoc(userRef, { applicationStatus: 'submitted' });
      showToast(`${applicant.displayName}님의 승인을 취소했습니다.`, 'info');
    } catch (error) {
      showToast('승인 취소에 실패했습니다.', 'error');
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
          onUpdateGender={handleUpdateGender}
          onUpdateAvatar={handleUpdateAvatar}
        />
      )}

      {isApplicantModalOpen && (
        <ApplicantDetailModal
          applicant={selectedApplicant}
          onClose={() => setIsApplicantModalOpen(false)}
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
            
            // ✨ [수정] 대시보드에는 'submitted' 목록 전달
            applicantRequests={dashboardApplicantsPagination.currentUsers}
            applicantRequestsPagination={dashboardApplicantsPagination}
            onApproveApplicant={handleApproveApplicant}
            onRejectApplicant={handleRejectApplicant}
            onViewApplicantDetails={handleViewApplicantDetails}
          />
        )}

        {activeTab === 'members' && (
          <MembersTab
            creatorUsers={filteredCreatorUsers}
            
            // ✨ [수정] 'approved' 목록을 전달
            applicantUsers={applicantUsersPagination.currentUsers}
            totalApplicantUsers={filteredApprovedUsers} 
            applicantSearchTerm={approvedSearchTerm}      
            setApplicantSearchTerm={setApprovedSearchTerm}  
            applicantGenderFilter={approvedGenderFilter}    
            setApplicantGenderFilter={setApprovedGenderFilter} 
            applicantPagination={applicantUsersPagination}
            onCancelApproval={handleCancelApproval} // ✨ '승인 취소' 핸들러 전달
            
            generalUsers={generalUsersPagination.currentUsers}
            totalGeneralUsers={filteredGeneralUsers}
            creatorSearchTerm={creatorSearchTerm}
            setCreatorSearchTerm={setCreatorSearchTerm}
            generalSearchTerm={generalSearchTerm}
            setGeneralSearchTerm={setGeneralSearchTerm}
            onUserClick={(user) => {
              setSelectedUser(user);
              setIsModalOpen(true);
            }}
            pagination={generalUsersPagination}
            creatorGenderFilter={creatorGenderFilter}
            setCreatorGenderFilter={setCreatorGenderFilter}
            generalGenderFilter={generalGenderFilter}
            setGeneralGenderFilter={setGeneralGenderFilter}
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