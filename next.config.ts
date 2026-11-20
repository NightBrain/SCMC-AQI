import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  agentRules: false,
  // ลิงก์/บุ๊กมาร์กเดิมที่ชี้ /v2 ยังใช้ได้
  async redirects() {
    return [{ source: '/v2', destination: '/detail', permanent: true }];
  },
};

export default nextConfig;
