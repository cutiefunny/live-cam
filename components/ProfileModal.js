// components/ProfileModal.js
'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAppStore from '@/store/useAppStore';
import styles from '@/app/Home.module.css';

export default function ProfileModal({ user, onClose, onUpdateProfile, onLogout }) {
    const router = useRouter();
    // ✨ [수정] userGender 추가
    const { showToast, isCreator, userGender } = useAppStore();
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [newAvatarFile, setNewAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user.photoURL);
    // ✨ [추가] 성별 state
    const [gender, setGender] = useState(userGender || 'unset');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB 이상 파일 제한
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

    const handleSave = async () => {
        if (!displayName.trim()) {
            showToast('닉네임을 입력하세요.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            // ✨ [수정] gender 값을 onUpdateProfile로 전달
            await onUpdateProfile(displayName, newAvatarFile, gender);
            showToast('프로필이 성공적으로 업데이트되었습니다.', 'success');
            onClose();
        } catch (error) {
            showToast('프로필 업데이트에 실패했습니다.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const goToMyProfile = () => {
        router.push(`/creator/${user.uid}`);
        onClose();
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h2>프로필 수정</h2>
                <div className={styles.profileEditSection}>
                    <div className={styles.avatarUploadSection}>
                        <img src={avatarPreview} alt="Avatar Preview" className={styles.modalProfileImage} />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            accept="image/png, image/jpeg"
                            style={{ display: 'none' }}
                        />
                        <button 
                            className={styles.avatarEditButton}
                            onClick={() => fileInputRef.current.click()}
                        >
                            이미지 변경
                        </button>
                    </div>

                    <div className={styles.profileInputGroup}>
                        <label htmlFor="displayName">닉네임</label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className={styles.profileInput}
                        />
                    </div>

                    {/* ✨ [추가] 성별 선택 드롭다운 */}
                    <div className={styles.profileInputGroup}>
                        <label htmlFor="gender">성별</label>
                        <select
                            id="gender"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className={styles.profileInput} // 기존 스타일 재사용
                        >
                            <option value="unset">선택 안함</option>
                            <option value="male">남성</option>
                            <option value="female">여성</option>
                        </select>
                    </div>
                </div>

                {isCreator && (
                    <button onClick={goToMyProfile} className={styles.myProfileButton}>
                        내 크리에이터 프로필
                    </button>
                )}
                
                <div className={styles.modalActions}>
                    <button onClick={handleSave} disabled={isSaving} className={styles.saveButton}>
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                    <button onClick={onLogout} className={styles.logoutButton}>로그아웃</button>
                </div>
            </div>
        </div>
    );
};
