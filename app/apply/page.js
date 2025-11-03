// app/apply/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAppStore from '@/store/useAppStore';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import styles from './Apply.module.css';

export default function ApplyPage() {
  const router = useRouter();
  
  // Zustand selector (개별 분리)
  const user = useAppStore((state) => state.user);
  const isAuthLoading = useAppStore((state) => state.isAuthLoading);
  const showToast = useAppStore((state) => state.showToast);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    gender: '',
    birthYear: '',
    region: '',
    height: '',
    occupation: '',
    education: '',
    referral: '',
    reason: '',
    charm: '',
  });

  // 동의 상태
  const [agreeContact, setAgreeContact] = useState(false);
  const [agreeReview, setAgreeReview] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 폼 초기화 추적
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  // 리디렉션 실행 추적
  const hasCheckedAuth = useRef(false);


  // 1. 인증 상태 확인 및 리디렉션
  useEffect(() => {
    // 로딩이 끝났고, 유저가 없고, 아직 인증 확인을 실행하지 않았다면
    if (!isAuthLoading && !user && !hasCheckedAuth.current) {
      hasCheckedAuth.current = true; 
      showToast('로그인이 필요한 서비스입니다.', 'error');
      router.replace('/');
    }
  }, [user, isAuthLoading, router, showToast]);

  // 2. 유저 정보로 폼 초기화 (user 객체가 유효할 때 1회 실행)
  useEffect(() => {
    if (user && !isFormInitialized) {
      setFormData((prev) => ({ ...prev, name: user.displayName || '' }));
      setIsFormInitialized(true); 
    }
  }, [user, isFormInitialized]); 

  // 핸들러 (변경 없음)
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenderChange = (gender) => {
    setFormData((prev) => ({ ...prev, gender }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('로그인 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    setIsLoading(true);

    // 1. 유효성 검사
    if (!formData.name || !formData.contact || !formData.gender || !formData.birthYear) {
      setError('이름, 연락처, 성별, 출생년도는 필수 항목입니다.');
      setIsLoading(false);
      return;
    }
    if (!agreeContact || !agreeReview) {
      setError('필수 동의 항목에 체크해주세요.');
      setIsLoading(false);
      return;
    }

    // 2. 'users' 컬렉션에 데이터 저장
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const dataToSave = {
        ...formData,
        agreeContact,
        agreeReview,
        applicationStatus: 'submitted', // '신청 완료' 상태
        applicationTimestamp: serverTimestamp(),
      };

      await setDoc(userDocRef, dataToSave, { merge: true });
      showToast('매칭 신청이 성공적으로 접수되었습니다.', 'success');
      router.push('/'); // 성공 시 메인 페이지로 이동

    } catch (err) {
      console.error('Error submitting application to user doc:', err);
      setError('신청서 제출에 실패했습니다. 다시 시도해주세요.');
      setIsLoading(false);
    }
  };
  
  // --- 렌더링 로직 ---

  // 1. 인증 로딩 중일 때
  if (isAuthLoading) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <p>Loading... (Auth check)</p>
        </div>
      </main>
    );
  }

  // 2. 인증 완료되었으나 로그아웃 상태일 때
  if (!user) {
    // (useEffect 1번이 리디렉션을 처리할 것이므로, 빈 화면을 렌더링)
    return null;
  }
  
  // 3. 인증 완료, 로그인 상태, 폼 초기화 전일 때
  if (!isFormInitialized) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <p>Loading... (Initializing form)</p>
        </div>
      </main>
    );
  }
  
  // 4. 모든 조건 만족 시 (폼 렌더링)
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>취향만남 매칭 신청</h1>
        <p className={styles.description}>
          조건이 아닌 결로 연결되는 진짜 만남을 준비해요
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* --- 기본 정보 --- */}
          <div className={styles.inputGroup}>
            <label htmlFor="name">이름</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} placeholder="이름을 입력해주세요" className={styles.input} disabled />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="contact">연락처</label>
            <input type="tel" id="contact" name="contact" value={formData.contact} onChange={handleChange} placeholder="예) 010-1234-5678" className={styles.input} />
          </div>
          <div className={styles.inputGroup}>
            <label>성별</label>
            <div className={styles.radioGroup}>
              <button type="button" onClick={() => handleGenderChange('female')} className={`${styles.genderButton} ${formData.gender === 'female' ? styles.genderButtonActive : ''}`}>
                여성
              </button>
              <button type="button" onClick={() => handleGenderChange('male')} className={`${styles.genderButton} ${formData.gender === 'male' ? styles.genderButtonActive : ''}`}>
                남성
              </button>
              <button type="button" onClick={() => handleGenderChange('other')} className={`${styles.genderButton} ${formData.gender === 'other' ? styles.genderButtonActive : ''}`}>
                기타
              </button>
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="birthYear">출생년도</label>
            <input type="number" id="birthYear" name="birthYear" value={formData.birthYear} onChange={handleChange} placeholder="예) 1995" className={styles.input} />
          </div>

          {/* --- 상세 정보 --- */}
          <div className={styles.divider}></div>

          <div className={styles.inputGroup}>
            <label htmlFor="region">거주지역</label>
            <input type="text" id="region" name="region" value={formData.region} onChange={handleChange} placeholder="예) 서울 강남구" className={styles.input} />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="height">키(cm)</label>
            <input type="number" id="height" name="height" value={formData.height} onChange={handleChange} placeholder="예) 170" className={styles.input} />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="occupation">직업</label>
            <input type="text" id="occupation" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="예) 회사원, 디자이너, 자영업 등" className={styles.input} />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="education">최종학력</label>
            <input type="text" id="education" name="education" value={formData.education} onChange={handleChange} placeholder="예) 4년제 졸업, 석사, 박사 등" className={styles.input} />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="referral">유입경로</label>
            <select id="referral" name="referral" value={formData.referral} onChange={handleChange} className={styles.input}>
              <option value="">선택해주세요</option>
              <option value="friend">지인 추천</option>
              <option value="sns">SNS (인스타그램, 페이스북 등)</option>
              <option value="search">검색 (네이버, 구글 등)</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="reason">소개를 신청한 이유</label>
            <textarea id="reason" name="reason" value={formData.reason} onChange={handleChange} placeholder="예: 진지한 만남을 원합니다." className={styles.textarea} rows={4}></textarea>
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="charm">자신의 매력 소개</label>
            <textarea id="charm" name="charm" value={formData.charm} onChange={handleChange} placeholder="대화 스타일, 성격, 취미 등 자신을 표현할 수 있는 내용을 적어주세요." className={styles.textarea} rows={4}></textarea>
          </div>

          {/* --- 필수 동의 --- */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>필수 동의</legend>
            <div className={styles.agreementGrid}>
              <div className={styles.agreementBox}>
                <h4>연락 안내 동의</h4>
                <div className={styles.checkboxContainer}>
                  <input type="checkbox" id="agreeContact" checked={agreeContact} onChange={(e) => setAgreeContact(e.target.checked)} />
                  <label htmlFor="agreeContact" className={styles.checkboxLabel}>
                    연락을 위한 개인정보 수집 및 이용에 동의합니다.
                  </label>
                </div>
              </div>
              <div className={styles.agreementBox}>
                <h4>매칭 검토 동의</h4>
                <div className={styles.checkboxContainer}>
                  <input type="checkbox" id="agreeReview" checked={agreeReview} onChange={(e) => setAgreeReview(e.target.checked)} />
                  <label htmlFor="agreeReview" className={styles.checkboxLabel}>
                    매칭 진행을 위한 내부 검토 및 연락에 동의합니다.
                  </label>
                </div>
              </div>
            </div>
          </fieldset>

          {error && <p className={styles.errorMessage}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? '신청 중...' : '신청하기'}
          </button>
        </form>
      </div>
    </main>
  );
}