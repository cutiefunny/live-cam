// components/admin/UserManagementModal.js
'use client';
import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import styles from './Admin.module.css';

export default function UserManagementModal({ user, onClose, onUpdateRole, onUpdateCoins }) {
    const [coinAmount, setCoinAmount] = useState('');
    const showToast = useAppStore((state) => state.showToast);

    if (!user) return null;

    const handleCoinAction = (action) => {
        const amount = parseInt(coinAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            showToast('유효한 코인 개수를 입력하세요.', 'error');
            return;
        }
        onUpdateCoins(user, action === 'give' ? amount : -amount);
        setCoinAmount('');
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>회원 관리</h2>
                    <button onClick={onClose} className={styles.closeButton}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.userInfoSection}>
                        <img src={user.photoURL || '/images/icon.png'} alt={user.displayName} className={styles.avatarLarge} />
                        <h3>{user.displayName || 'N/A'}</h3>
                        <p>{user.email}</p>
                        <p>보유 코인: 💰 {user.coins}</p>
                    </div>
                    <div className={styles.managementSection}>
                        <h4>코인 관리</h4>
                        <div className={styles.coinControl}>
                            <input
                                type="number"
                                value={coinAmount}
                                onChange={(e) => setCoinAmount(e.target.value)}
                                placeholder="코인 개수"
                                className={styles.coinInput}
                            />
                            <button onClick={() => handleCoinAction('give')} className={styles.giveButton}>지급</button>
                            <button onClick={() => handleCoinAction('take')} className={styles.takeButton}>회수</button>
                        </div>
                    </div>
                    <div className={styles.managementSection}>
                        <h4>역할 관리</h4>
                        <button onClick={() => onUpdateRole(user)} className={styles.actionButton}>
                            {user.isCreator ? '일반 회원으로 변경' : '크리에이터로 지정'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};