module.exports = {
  webpack: (
    config,
    {buildId, dev, isServer, defaultLoaders, nextRuntime, webpack}
  ) => {
    if (config.name === 'edge-server') {
      config.resolve.conditionNames = ['worker', 'import', 'require']
      config.experiments = {...config.experiments, outputModule: true}
      config.externalsType = 'module'
      config.externals = '@alinea/sqlite-wasm'
    }
    // Important: return the modified config
    return config
  },
  productionBrowserSourceMaps: true,
  typescript: {
    // We check types in plenty other places, no need to waste time here
    ignoreBuildErrors: true
  },
  // https://github.com/vercel/next.js/issues/37142#issuecomment-1135206523
  experimental: {
    legacyBrowsers: false,
    browsersListForSwc: true
  }
}
