module.exports = {
  webpack: (config, {buildId, dev, isServer, defaultLoaders, webpack}) => {
    if (isServer) {
      config.externals = [
        ...config.externals,
        '@alinea/auth.passwordless',
        '@alinea/auth.passwordless/PasswordLessAuth.js',
        '@alinea/cli',
        '@alinea/client',
        '@alinea/core',
        '@alinea/dashboard',
        '@alinea/editor',
        '@alinea/cache',
        '@alinea/input.list',
        '@alinea/input.number',
        '@alinea/input.text',
        '@alinea/server',
        '@alinea/ui',
        'yjs'
      ]
      config.externalsType = 'import'
      config.optimization.providedExports = true
    }
    return config
  },
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  }
}
