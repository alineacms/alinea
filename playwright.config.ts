import {defineConfig, devices} from 'playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 61001)
const host = '127.0.0.1'
const baseURL = `http://${host}:${port}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']}
    }
  ],
  webServer: {
    command: `bunx vite --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
