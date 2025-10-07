// components/CoinModal.js
'use client';
import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import styles from '@/app/Home.module.css';

const coinPackages = [
  { amount: 50, price: '₩5,000' },
  { amount: 110, price: '₩10,000' },
  { amount: 250, price: '₩20,000' },
  { amount: 700, price: '₩50,000' },
];

export default function CoinModal({ onClose, onRequestCharge }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useAppStore();

  const handleRequestClick = async (pkg) => {
    setIsProcessing(true);
    try {
      await onRequestCharge(pkg.amount, pkg.price);
      showToast('충전 요청이 완료되었습니다. 관리자 승인 후 코인이 지급됩니다.', 'success');
      onClose();
    } catch (error) {
      showToast('충전 요청에 실패했습니다.', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>코인 충전</h2>
        {isProcessing ? (
          <p>요청 중...</p>
        ) : (
          <div className={styles.coinPackageGrid}>
            {coinPackages.map((pkg) => (
              <div
                key={pkg.amount}
                className={styles.coinPackage}
                onClick={() => handleRequestClick(pkg)}
              >
                <div className={styles.coinPackageAmount}>💰 {pkg.amount}</div>
                <div className={styles.coinPackagePrice}>{pkg.price}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}