// components/admin/Pagination.js
import React from 'react';
import styles from './Admin.module.css';

const Pagination = ({ currentPage, totalPages, paginate }) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={styles.pagination}>
      <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
        &laquo; Prev
      </button>
      <span> Page {currentPage} of {totalPages} </span>
      <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
        Next &raquo;
      </button>
    </div>
  );
};

export default Pagination;