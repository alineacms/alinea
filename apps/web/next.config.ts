import {NextConfig} from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  serverExternalPackages: ['@alinea/generated'],
  async rewrites() {
    return [
      {
        source: '/docs\\::framework/:path*',
        destination: '/docs/:framework/:path*'
      }
    ]
  }
}

export default nextConfig
