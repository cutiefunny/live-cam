// next.config.mjs
import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✨ [수정] reactStrictMode를 false로 변경하여 이중 렌더링을 방지합니다.
  reactStrictMode: false,
  // ✨ [추가 시작] 이미지 최적화를 위한 설정
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
  // ✨ [추가 끝]
};

export default withPWA({
  dest: "public",
})(nextConfig);