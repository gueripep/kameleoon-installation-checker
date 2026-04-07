/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: false,
  output: 'standalone',
  serverExternalPackages: ['puppeteer-extra', 'puppeteer-extra-plugin-stealth', 'puppeteer'],
};

export default nextConfig;
