// hooks/useMatchingUsers.js
import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import useAppStore from '@/store/useAppStore';

/**
 * 현재 사용자의 성별에 따라 반대 성별의 사용자를 가져오는 훅
 * @param {string | null} currentUserGender - 현재 사용자의 성별 ('male', 'female', null)
 * @returns {{matchingUsers: Array<any>, isLoading: boolean}}
 */
export function useMatchingUsers(currentUserGender) {
  const { user } = useAppStore();
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
        setIsLoading(false);
        return;
    };

    let q;
    const usersRef = collection(firestore, 'users');

    if (currentUserGender === 'male') {
      // 현재 유저가 남성이면, 여성 유저 10명
      q = query(usersRef, where('gender', '==', 'female'), limit(10));
    } else if (currentUserGender === 'female') {
      // 현재 유저가 여성이면, 남성 유저 10명
      q = query(usersRef, where('gender', '==', 'male'), limit(10));
    } else {
      // 성별 미설정 시, 모든 유저 중 10명 (본인 제외)
      // Firestore '!=' 쿼리는 null/undefined 필드도 제외하므로,
      // 우선 'male' 사용자 10명을 가져오는 것으로 대체합니다. (또는 'female')
      // 혹은 성별 관계없이 10명을 가져옵니다. (단, 색인 필요할 수 있음)
      // 여기서는 성별 관계없이 10명을 가져오되, 본인을 클라이언트에서 필터링합니다.
      q = query(usersRef, limit(11)); // 본인이 포함될 수 있으므로 11명
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(u => u.uid !== user.uid) // 본인 제외
        .slice(0, 10); // 10명으로 자르기

      setMatchingUsers(usersList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching matching users: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();

  }, [currentUserGender, user]);

  return { matchingUsers, isLoading };
}
