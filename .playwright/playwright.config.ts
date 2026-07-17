import {defineConfig} from '@playwright/experimental-ct-react'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defaultClientConditions} from 'vite'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))

export default defineConfig({
  testDir: resolve(rootDir, 'src'),
  testMatch: '**/*.spec.tsx',
  use: {
    ctTemplateDir: '.',
    ctViteConfig: {
      resolve: {
        // Component tests disable Vite's config file, so opt into source
        // package imports here as well.
        conditions: ['alinea-src', ...defaultClientConditions]
      }
    },
    viewport: {width: 1280, height: 800}
  }
})
