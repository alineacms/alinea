import {withAlinea} from 'alinea/next'
import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true
}

export default withAlinea(nextConfig)
