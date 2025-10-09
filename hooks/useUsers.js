// hooks/useUsers.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; // ✨ [수정] setDoc 임포트
import { auth, firestore } from '@/lib/firebase'; // ✨ [수정] firestore 임포트

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // ✨ [수정 시작] updateDoc 대신 setDoc과 { merge: true } 사용
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        setDoc(userDocRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          email: currentUser.email,
          lastLogin: serverTimestamp(),
        }, { merge: true }); // 문서가 없으면 생성, 있으면 병합합니다.
        // ✨ [수정 끝]
      }
    });
    return () => unsubscribe();
  }, []);

  // API를 통해 모든 Auth 유저 목록을 가져오는 로직은 그대로 유지합니다.
  useEffect(() => {
    async function fetchAllUsers() {
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error('Failed to fetch user list');
        }
        const userList = await response.json();
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