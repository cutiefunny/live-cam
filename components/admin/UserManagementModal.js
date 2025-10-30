// components/admin/UserManagementModal.js
'use client';
import { useState, useEffect, useRef } from 'react'; // ✨ [수정] useRef 추가
import useAppStore from '@/store/useAppStore';
import styles from './Admin.module.css';

// ✨ [수정] onUpdateAvatar prop 추가
export default function UserManagementModal({ user, onClose, onUpdateRole, onUpdateCoins, onUpdateGender, onUpdateAvatar }) {
    const [coinAmount, setCoinAmount] = useState('');
    const [selectedGender, setSelectedGender] = useState(user?.gender || 'unset');
    // ✨ [추가] 아바타 파일 및 미리보기 state
    const [newAvatarFile, setNewAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.photoURL);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef(null);
    
    const showToast = useAppStore((state) => state.showToast);

    // ✨ [수정] 모달이 열리는 사용자(user prop)가 바뀔 때마다 state 동기화
    useEffect(() => {
        setSelectedGender(user?.gender || 'unset');
        setAvatarPreview(user?.photoURL || '/images/icon.png'); // ✨ [추가] 아바타 미리보기 리셋
        setNewAvatarFile(null); // ✨ [추가] 파일 선택 리셋
    }, [user]);

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

    const handleGenderSave = () => {
        onUpdateGender(user, selectedGender);
    };

    // ✨ [추가] 아바타 변경 핸들러
    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB 제한
                showToast('이미지 파일은 5MB를 초과할 수 없습니다.', 'error');
                return;
            }
            setNewAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // ✨ [추가] 아바타 저장 핸들러
    const handleAvatarSave = async () => {
        if (!newAvatarFile) return;
        setIsUploadingAvatar(true);
        try {
            await onUpdateAvatar(user, newAvatarFile);
            setNewAvatarFile(null);
        } catch (error) {
            // 에러 토스트는 onUpdateAvatar 핸들러에서 처리
        } finally {
            setIsUploadingAvatar(false);
        }
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
                        {/* ✨ [수정] 아바타 미리보기 및 변경 UI */}
                        <img src={avatarPreview || '/images/icon.png'} alt={user.displayName} className={styles.avatarLarge} />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            accept="image/png, image/jpeg"
                            style={{ display: 'none' }}
                        />
                        <button 
                            className={styles.avatarEditButtonModal}
                            onClick={() => fileInputRef.current.click()}
                        >
                            사진 변경
                        </button>
                        {newAvatarFile && (
                            <button
                                onClick={handleAvatarSave}
                                disabled={isUploadingAvatar}
                                className={styles.giveButton} // 저장 버튼 스타일 재사용
                                style={{ width: '100%', marginTop: '0.75rem' }}
                            >
                                {isUploadingAvatar ? '저장 중...' : '사진 저장'}
                            </button>
                        )}
                        {/* ✨ [수정] --- */}
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
                    <div className={styles.managementSection}>
                        <h4>성별 관리</h4>
                        <div className={styles.genderControl}>
                            <select
                                value={selectedGender}
                                onChange={(e) => setSelectedGender(e.target.value)}
                                className={styles.searchFilter}
                                style={{ width: '100%' }}
                            >
                                <option value="unset">미설정</option>
                                <option value="male">남성</option>
                                <option value="female">여성</option>
                            </select>
                            <button
                                onClick={handleGenderSave}
                                className={styles.giveButton}
                                style={{ width: '100%', marginTop: '0.75rem' }}
                            >
                                성별 저장
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
