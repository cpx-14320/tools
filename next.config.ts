import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 首頁主視覺是在伺服器端掃 public/expenses 底下的 main-kv-*.png 隨機挑一張
  // （見 lib/expenses/hero-images.server.ts）。Vercel 的 serverless function 預設不會
  // 把 public/ 打包進去——那些檔案是交給 CDN 送的——所以這裡明確把它帶進函式的檔案
  // 追蹤清單，不然正式站上掃到的會是空的。
  outputFileTracingIncludes: {
    "/tools/expenses": ["./public/expenses/main-kv-*"],
  },
};

export default nextConfig;
