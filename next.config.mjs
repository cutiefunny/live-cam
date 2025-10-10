// next.config.mjs
import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✨ [수정] reactStrictMode를 false로 변경하여 이중 렌더링을 방지합니다.
  reactStrictMode: false,
};

export default withPWA({
  dest: "public",
})(nextConfig);