module.exports = {
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
