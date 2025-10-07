// app/layout.js
'use client'; 
import { useEffect } from 'react';
import initializeLogger from '@/lib/logger';
import "./globals.css";
import Toast from '@/components/Toast'; // ✨ [추가]

export default function RootLayout({ children }) {
  useEffect(() => {
    initializeLogger();
    console.log('Logger initialized.');
  }, []);

  return (
    <html lang="en">
      <body>
        <Toast /> {/* ✨ [추가] */}
        {children}
      </body>
    </html>
  );
}