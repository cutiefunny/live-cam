// next.config.mjs
import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '**',
      }
    ],
  },
};

export default withPWA({
  dest: "public",
  // ✨ [추가] PWA 캐싱 전략 및 기타 설정 (선택 사항)
  // register: true, // 서비스 워커 자동 등록 (기본값 true)
  // skipWaiting: true, // 서비스 워커 새 버전 즉시 활성화 (기본값 true)
  // disable: process.env.NODE_ENV === 'development', // 개발 환경에서 PWA 비활성화
  // swSrc: 'public/sw.js', // 커스텀 서비스 워커 파일 경로 (선택 사항)
  // reloadOnOnline: true, // 네트워크 복귀 시 페이지 새로고침
})(nextConfig);