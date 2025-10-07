// components/CallQualityIndicator.js
import React from 'react';
import styles from './CallQualityIndicator.module.css';

const QualityIcon = ({ quality }) => {
  return (
    <div className={`${styles.iconContainer} ${styles[quality]}`}>
      <span className={styles.bar}></span>
      <span className={styles.bar}></span>
      <span className={styles.bar}></span>
    </div>
  );
};

const CallQualityIndicator = ({ quality }) => {
  const qualityText = {
    good: 'Good',
    average: 'Average',
    poor: 'Poor',
  };

  return (
    <div className={styles.container}>
      <QualityIcon quality={quality} />
      <span className={styles.text}>{qualityText[quality]}</span>
    </div>
  );
};

export default CallQualityIndicator;