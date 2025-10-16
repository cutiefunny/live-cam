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
  const isAdmin = pathname.startsWith('/admin');

  useEffect(() => {
    initializeLogger();
    console.log('Logger initialized.');
  }, []);

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
      {/* ✨ [추가] PWA 관련 meta 태그 및 link 태그 */}
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no" />
        <meta name="description" content="실시간 영상 채팅 서비스" />
        <meta name="keywords" content="취향캠톡, 영상채팅, 실시간, PWA" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/images/icon.png"></link>
        {/* iOS에서 풀스크린 앱처럼 보이게 하는 설정 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="취향캠톡" />
      </head>
      <body>
        {getLayout()}
      </body>
    </html>
  );
}

//롤백