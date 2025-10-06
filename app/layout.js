// app/layout.js
'use client'; 
import { useEffect } from 'react';
import initializeLogger from '@/lib/logger';
import "./globals.css";

export default function RootLayout({ children }) {
  useEffect(() => {
    initializeLogger();
    console.log('Logger initialized.');
  }, []);

  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}