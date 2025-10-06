// hooks/useUsers.js
import { useState, useEffect } from 'react';
import { ref, update, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { database, auth } from '@/lib/firebase';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 현재 로그인한 유저의 마지막 로그인 시간 업데이트 로직은 그대로 유지합니다.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}`);
        update(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          email: currentUser.email,
          lastLogin: serverTimestamp(),
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // ✨ [수정] Firebase DB 대신 API를 통해 모든 Auth 유저 목록을 가져옵니다.
  useEffect(() => {
    async function fetchAllUsers() {
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error('Failed to fetch user list');
        }
        const userList = await response.json();
        // 생성 시간 기준으로 최신순 정렬
        setUsers(userList.sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime)));
      } catch (error) {
        console.error("Error fetching all users:", error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchAllUsers();
  }, []);

  return { users, isLoading };
}