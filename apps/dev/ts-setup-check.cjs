// Temporary diagnostic: run Next's TypeScript setup verification with the
// error visible, since `next build` swallows it when type checking is off.
const {verifyAndRunTypeScript} = require('next/dist/lib/verify-typescript-setup')
const dir = process.cwd()
verifyAndRunTypeScript({
  dir,
  distDir: '.next',
  cacheDir: '.next/cache',
  strictRouteTypes: false,
  tsconfigPath: 'tsconfig.json',
  shouldRunTypeCheck: false,
  typedRoutes: false,
  disableStaticImages: false,
  hasAppDir: true,
  hasPagesDir: false,
  appDir: `${dir}/app`,
  pagesDir: undefined,
  debugBuildPaths: false
}).then(
  result => console.log('ts setup ok', result),
  error => {
    console.error('ts setup failed', error)
    process.exit(1)
  }
)
