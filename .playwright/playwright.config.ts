import {defineConfig} from '@playwright/experimental-ct-react'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))

export default defineConfig({
  testDir: resolve(rootDir, 'src'),
  testMatch: '**/*.spec.tsx',
  use: {
    ctTemplateDir: '.',
    viewport: {width: 1280, height: 800}
  }
})
