module.exports = {
  webpack: (config, {buildId, dev, isServer, defaultLoaders, webpack}) => {
    if (isServer) {
      config.externals = [
        ...config.externals,
        '@alinea/core',
        '@alinea/dashboard',
        '@alinea/server'
      ]
      config.externalsType = 'import'
      config.optimization.providedExports = true
    }
    return config
  },
  experimental: {esmExternals: true}
}
