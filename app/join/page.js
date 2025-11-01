// app/join/page.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Join.module.css';

export default function JoinPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // 약관 동의
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAllAgree = (e) => {
    const isChecked = e.target.checked;
    setTermsAgreed(isChecked);
    setPrivacyAgreed(isChecked);
    setMarketingAgreed(isChecked);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 1. 기본 유효성 검사
    if (!email || !password || !displayName) {
      setError('필수 항목을 모두 입력해주세요.');
      setIsLoading(false);
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }
    if (!termsAgreed || !privacyAgreed) {
      setError('필수 이용약관에 동의해주세요.');
      setIsLoading(false);
      return;
    }

    // 2. Firebase 회원가입 로직 (추후 연동)
    try {
      // TODO: Firebase createUserWithEmailAndPassword 연동
      console.log('회원가입 시도:', {
        email,
        password,
        displayName,
        agreements: { termsAgreed, privacyAgreed, marketingAgreed },
      });
      // 예: await signUp(email, password, displayName);
      
      // 성공 시
      alert('회원가입 성공! (임시) 로그인을 진행해주세요.');
      // router.push('/'); // 성공 시 로그인 페이지로 이동
      
    } catch (authError) {
      // Firebase 에러 처리
      // 예: if (authError.code === 'auth/email-already-in-use')
      setError('회원가입에 실패했습니다. (예: 이미 사용 중인 이메일)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>회원가입</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              className={styles.input}
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
              className={styles.input}
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="passwordConfirm">비밀번호 확인</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 확인"
              required
              className={styles.input}
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="displayName">닉네임</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="닉네임"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.divider}></div>

          <div className={styles.agreementContainer}>
            <div className={styles.checkboxContainerAll}>
              <input
                type="checkbox"
                id="all-agree"
                onChange={handleAllAgree}
                checked={termsAgreed && privacyAgreed && marketingAgreed}
              />
              <label htmlFor="all-agree" className={styles.checkboxLabelAll}>
                전체 동의 (선택항목 포함)
              </label>
            </div>
            
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                id="terms-agree"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
              />
              <label htmlFor="terms-agree" className={styles.checkboxLabel}>
                [필수] 이용약관 동의
              </label>
              <a href="/terms" target="_blank" className={styles.viewLink}>보기</a>
            </div>
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                id="privacy-agree"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
              />
              <label htmlFor="privacy-agree" className={styles.checkboxLabel}>
                [필수] 개인정보 수집 및 이용 동의
              </label>
              <a href="/privacy" target="_blank" className={styles.viewLink}>보기</a>
            </div>
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                id="marketing-agree"
                checked={marketingAgreed}
                onChange={(e) => setMarketingAgreed(e.target.checked)}
              />
              <label htmlFor="marketing-agree" className={styles.checkboxLabel}>
                [선택] 마케팅 정보 수신 동의
              </label>
            </div>
          </div>

          {error && <p className={styles.errorMessage}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className={styles.loginLink}>
          이미 회원이신가요? <Link href="/">로그인하기</Link>
        </p>
      </div>
    </main>
  );
}