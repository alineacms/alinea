module.exports = {
  webpack: (config, {buildId, dev, isServer, defaultLoaders, webpack}) => {
    // https://github.com/vercel/next.js/issues/17806#issuecomment-913437792
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false
      }
    })
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
  experimental: {
    esmExternals: 'loose'
  },
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  }
}
