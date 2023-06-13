/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },

  experimental: {
    serverActions: true
  }
}

module.exports = nextConfig
