import {withAlinea} from 'alinea/next'
import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },
  async redirects() {
    return [
      {
        source: '/llms.txt',
        destination: '/llms-full.txt',
        permanent: true
      },
      {
        source: '/docs/fields/:path*',
        destination: '/docs/configuration/fields/:path*',
        permanent: true
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/docs\\::framework/:path*',
        destination: '/docs/:framework/:path*'
      }
    ]
  }
}

export default withAlinea(nextConfig)
