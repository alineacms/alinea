module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    })

    return config
  },
  images: {
    deviceSizes: [640, 1280, 1920, 2560, 3840],
    domains: ['localhost:3000'],
    formats: ['image/avif', 'image/webp']
  },
  swcMinify: true,
  eslint: {
    dirs: ['src']
  }
}
