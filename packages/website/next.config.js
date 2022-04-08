module.exports = {
  productionBrowserSourceMaps: true,
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
        '@alineacms/auth.passwordless',
        '@alineacms/auth.passwordless/PasswordLessAuth.js',
        '@alineacms/cli',
        '@alineacms/client',
        '@alineacms/core',
        '@alineacms/dashboard',
        '@alineacms/editor',
        '@alineacms/input.list',
        '@alineacms/input.number',
        '@alineacms/input.text',
        '@alineacms/backend',
        '@alineacms/ui',
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
