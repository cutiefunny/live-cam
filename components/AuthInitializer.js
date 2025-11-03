// components/AuthInitializer.js
'use client';
import { useAuth } from '@/hooks/useAuth';

export default function AuthInitializer() {
  // 이 훅을 호출하는 것만으로 onAuthStateChanged 리스너가 등록되고
  // Zustand 스토어(isAuthLoading: false)가 갱신됩니다.
  useAuth();
  
  return null; // 이 컴포넌트는 UI를 렌더링하지 않습니다.
}