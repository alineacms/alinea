import type {NextConfig} from 'next'

export default {
  async rewrites() {
    const dev = process.env.ALINEA_DEV_SERVER
    return [
      {
        source: '/admin/:path*',
        destination: `${dev}/admin/:path*`
      }
    ]
  }
} satisfies NextConfig
