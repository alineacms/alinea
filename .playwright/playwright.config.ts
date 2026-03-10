import {defineConfig, devices} from '@playwright/experimental-ct-react'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ctViteConfig = {
  resolve: {
    alias: [
      {
        find: /^alinea$/,
        replacement: resolve(rootDir, 'src/index.ts')
      },
      {
        find: /^alinea\/(.*)$/,
        replacement: `${resolve(rootDir, 'src')}/$1`
      }
    ]
  }
}
const sharedUse = {
  ctTemplateDir: '.',
  viewport: {width: 1280, height: 800},
  ctViteConfig
}

export default defineConfig({
  testDir: resolve(rootDir, 'src'),
  testMatch: '**/*.spec.tsx',
  use: sharedUse,
  projects: [
    {
      name: 'chromium',
      use: {...sharedUse, ...devices['Desktop Chrome']}
    }
  ]
})
