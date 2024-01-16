/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (
    config,
    {buildId, dev, isServer, defaultLoaders, nextRuntime, webpack}
  ) => {
    if (config.name === 'edge-server') {
      config.resolve.conditionNames = ['worker', 'import', 'require']
      config.module.rules.unshift({
        test: /\.wasm$/,
        loader: 'next-middleware-wasm-loader',
        type: 'javascript/auto'
      })
    }
    return config
  },
  reactStrictMode: false,
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

module.exports = nextConfig
