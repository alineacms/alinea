/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverComponentsExternalPackages: ['@alinea/generated']
  }
}

module.exports = nextConfig
