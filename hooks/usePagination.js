// hooks/usePagination.js
import { useState, useEffect } from 'react';

export function usePagination(data = [], usersPerPage = 10) { // ✨ [수정] data 기본값을 빈 배열로 설정
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalPages = Math.ceil(data.length / usersPerPage);
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = data.slice(indexOfFirstUser, indexOfLastUser);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return {
    currentPage,
    totalPages,
    paginate,
    currentUsers,
    setCurrentPage,
  };
}