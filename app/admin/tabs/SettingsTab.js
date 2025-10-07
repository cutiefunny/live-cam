// app/admin/tabs/SettingsTab.js
import React, { useState, useEffect } from 'react';
import styles from '@/components/admin/Admin.module.css';

const SettingsTab = ({ initialSettings, onSave }) => {
  const [costToStart, setCostToStart] = useState(0); // ✨ [추가]
  const [costPerMinute, setCostPerMinute] = useState(10);
  const [creatorShareRate, setCreatorShareRate] = useState(90);

  useEffect(() => {
    if (initialSettings) {
      setCostToStart(initialSettings.costToStart || 0); // ✨ [추가]
      setCostPerMinute(initialSettings.costPerMinute || 10);
      setCreatorShareRate(initialSettings.creatorShareRate || 90);
    }
  }, [initialSettings]);

  const handleSave = () => {
    const settings = {
      costToStart: parseInt(costToStart, 10), // ✨ [추가]
      costPerMinute: parseInt(costPerMinute, 10),
      creatorShareRate: parseInt(creatorShareRate, 10),
    };
    onSave(settings);
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>통화 설정</h2>
      <div className={styles.gridItem} style={{ maxWidth: '500px' }}>
        {/* ✨ [추가] 통화 시작 시 코인 소모량 UI */}
        <div className={styles.settingRow}>
          <label htmlFor="costToStart">통화 시작 시 코인 소모량</label>
          <input
            id="costToStart"
            type="number"
            value={costToStart}
            onChange={(e) => setCostToStart(e.target.value)}
            className={styles.coinInput}
          />
        </div>
        <div className={styles.settingRow}>
          <label htmlFor="costPerMinute">분당 코인 소모량</label>
          <input
            id="costPerMinute"
            type="number"
            value={costPerMinute}
            onChange={(e) => setCostPerMinute(e.target.value)}
            className={styles.coinInput}
          />
        </div>
        <div className={styles.settingRow}>
          <label htmlFor="creatorShareRate">크리에이터 정산 비율 (%)</label>
          <input
            id="creatorShareRate"
            type="number"
            value={creatorShareRate}
            onChange={(e) => setCreatorShareRate(e.target.value)}
            placeholder="예: 90"
            className={styles.coinInput}
          />
        </div>
        <button onClick={handleSave} className={styles.button} style={{ marginTop: '1rem' }}>
          설정 저장
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
