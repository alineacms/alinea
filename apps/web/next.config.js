const {withAlinea} = require('alinea/next')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  rewrites() {
    return [
      {
        source: '/docs\\::framework/:path*',
        destination: '/docs/:framework/:path*'
      }
    ]
  }
}

module.exports = withAlinea(nextConfig)
