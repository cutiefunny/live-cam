// app/layout.js
'use client'; 
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import initializeLogger from '@/lib/logger';
import "./globals.css";
import Toast from '@/components/Toast';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isRoom = pathname.startsWith('/room/');
  const isAdmin = pathname.startsWith('/admin'); // ✨ [추가] 어드민 페이지인지 확인

  useEffect(() => {
    initializeLogger();
    console.log('Logger initialized.');
  }, []);

  // ✨ [수정] 페이지 경로에 따라 다른 레이아웃을 적용
  const getLayout = () => {
    if (isRoom || isAdmin) {
      return (
        <>
          <Toast />
          {children}
        </>
      );
    } else {
      return (
        <div className="app-container">
          <Toast />
          {children}
        </div>
      );
    }
  };

  return (
    <html lang="en">
      <body>
        {getLayout()}
      </body>
    </html>
  );
}

//롤백 다시 커밋