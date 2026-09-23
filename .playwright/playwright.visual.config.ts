import {defineConfig} from '@playwright/experimental-ct-react'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defaultClientConditions} from 'vite'
import {alineaFixturePlugin} from '../src/dashboard/plugins/alineaFixturePlugin.js'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))

// Visual regression suite. Baselines are rendered on macOS, so this config is
// kept separate from the default spec run (which CI runs on linux).
export default defineConfig({
  testDir: resolve(rootDir, 'test/visual'),
  testMatch: ['**/*.spec.tsx'],
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
  workers: 3,
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    }
  },
  use: {
    ctTemplateDir: '.',
    ctCacheDir: '.cache/visual',
    ctViteConfig: {
      plugins: [alineaFixturePlugin()],
      resolve: {
        conditions: ['alinea-src', ...defaultClientConditions]
      }
    },
    viewport: {width: 1280, height: 800},
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Europe/Brussels'
  }
})
