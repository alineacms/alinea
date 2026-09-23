import {withAlinea} from 'alinea/next'
import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  experimental: {
    useCache: true
  }
}

export default withAlinea(nextConfig)
