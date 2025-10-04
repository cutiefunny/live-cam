// next.config.mjs
import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 👈 false로 변경
};

export default withPWA({
  dest: "public",
})(nextConfig);