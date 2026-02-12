import type {NextConfig} from 'next'

export default {
  async redirects() {
    const dev = process.env.ALINEA_DEV_SERVER
    return [
      {permanent: true, source: '/admin/~dev', destination: `${dev}/~dev`}
    ]
  },
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
