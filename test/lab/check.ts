/**
 * Run every scenario of the lab in a headless browser and report its checks:
 * `bun lab:check [--built] [scenario ...]`. Fails when a check fails;
 * findings are reported without failing. With `--built` the scenarios run on
 * the engine `bun lab:build` wrote, served as the website serves it. Set
 * LAB_CHROMIUM to use another Chromium.
 */
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'
import {createServer} from 'vite'

interface Check {
  label: string
  kind: 'pass' | 'fail' | 'info' | 'finding'
  detail?: string
}

const args = process.argv.slice(2)
const built = args.includes('--built')
const only = args.filter(arg => arg !== '--built')
const verbose = Boolean(process.env.LAB_EVENTS)
const server = built ? serveBuilt() : await serveSource()
const url = server.url

/** The lab page from source, through Vite. */
async function serveSource() {
  const vite = await createServer({
    configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
    server: {port: 0},
    logLevel: 'warn'
  })
  await vite.listen()
  const url = vite.resolvedUrls?.local[0]
  if (!url) throw new Error('The lab server did not start')
  return {url, close: () => vite.close()}
}

/** The built engine from the website's public files, as the page loads it. */
function serveBuilt() {
  const publicDir = fileURLToPath(
    new URL('../../apps/web/public', import.meta.url)
  )
  const page = `<!doctype html><meta charset="utf-8"><script type="module">
    const {start} = await import('/lab/engine.js')
    await start()
  </script>`
  const bun = Bun.serve({
    port: 0,
    async fetch(request) {
      const {pathname} = new URL(request.url)
      if (pathname === '/')
        return new Response(page, {headers: {'content-type': 'text/html'}})
      const file = Bun.file(join(publicDir, pathname))
      if (!pathname.startsWith('/lab/') || !(await file.exists()))
        return new Response('Not found', {status: 404})
      return new Response(file)
    }
  })
  return {url: bun.url.href, close: async () => bun.stop()}
}
const browser = await chromium.launch({
  executablePath: process.env.LAB_CHROMIUM
})
let failed = 0
try {
  const page = await browser.newPage()
  page.on('pageerror', error => console.error(`page error: ${error.message}`))
  await page.goto(url)
  await page.waitForFunction(
    () => {
      const lab = (window as any).lab
      return lab?.deployments?.active && !lab.lab.busy
    },
    null,
    {timeout: 120_000}
  )
  const ids: Array<string> = await page.evaluate(() =>
    (window as any).lab.scenarios.map((s: {id: string}) => s.id)
  )
  for (const id of ids) {
    if (only.length && !only.includes(id)) continue
    const start = performance.now()
    const run = await page.evaluate(async id => {
      const {scenarios, runScenario, runs, network, bus} = (window as any).lab
      network.latency = 20
      await runScenario(scenarios.find((s: {id: string}) => s.id === id))
      const result = runs[id]
      return {
        status: result.status as string,
        checks: result.checks as Array<Check>,
        events: bus.events
          .filter(
            (e: {id: number; kind: string}) =>
              e.id >= result.fromEvent && e.kind !== 'http'
          )
          .map(
            (e: {node: string; part?: string; kind: string; text: string}) =>
              `${e.node}${e.part ? `/${e.part}` : ''} ${e.kind}: ${e.text}`
          ) as Array<string>
      }
    }, id)
    const seconds = ((performance.now() - start) / 1000).toFixed(1)
    console.log(`\n${id} (${seconds}s)`)
    const icons = {pass: '✓', fail: '✗', info: 'i', finding: '⚑'}
    for (const check of run.checks)
      console.log(
        `  ${icons[check.kind]} ${check.label}${check.detail ? `  [${check.detail}]` : ''}`
      )
    const bad = run.checks.some(check => check.kind === 'fail')
    if (bad) failed++
    if (bad || verbose)
      for (const line of run.events) console.log(`      · ${line}`)
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failed ? `\n${failed} scenario(s) failed` : '\nEvery check passed')
process.exit(failed ? 1 : 0)
