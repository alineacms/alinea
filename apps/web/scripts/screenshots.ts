/**
 * Captures product screenshots of the in-browser demo dashboard.
 *
 *   bun screenshots                     capture every shot, light and dark
 *   bun screenshots dashboard-product   capture only the named shots
 *   bun screenshots --scheme light      capture one color scheme
 *   bun screenshots --publish           capture, then upload to the cms media
 *
 * Expects the website dev server to run (`bun run web:run`). Set
 * SCREENSHOTS_BASE_URL (default http://localhost:3000) and, for --publish,
 * ALINEA_MCP_URL (default http://localhost:4500/mcp).
 *
 * Captures land in apps/web/.cache/screenshots as WebP. Publishing uploads
 * them through the alinea dev MCP server into the "Screenshots" folder of the
 * main media library. Every shot keeps one media entry, found by its title,
 * so re-running replaces the image while the entry id and file path stay the
 * same and pages that reference it pick up the new capture.
 *
 * Pass shot names to publish a subset, eg. only the ones the site uses:
 *   bun screenshots --publish dashboard-product dashboard-localiser
 */

import {mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page
} from 'playwright'

type Scheme = 'light' | 'dark'

interface Shot {
  name: string
  /** Dashboard location, the part after `#` */
  hash: string
  /** Alt text of the published media entry */
  alt: string
  viewport?: {width: number; height: number}
  /** Bring the dashboard into the state to capture */
  prepare?(page: Page): Promise<void>
}

const ferris = '3JjYg1RR8ghz3NENJTrtX2QiHgP'
const home = '3JjYg2xcgCGTqmAoAf36mA6hWqR'

const shots: Array<Shot> = [
  {
    name: 'dashboard-product',
    alt: 'The Alinea dashboard editing a product, with a live preview of the page beside the form',
    hash: `/entry/demo/pages:en/${ferris}`,
    async prepare(page) {
      await page.getByRole('tab', {name: 'Preview'}).click()
    }
  },
  {
    name: 'dashboard-localiser',
    alt: 'A product in Dutch, with tabs to switch the localised badge field between English, Dutch and French',
    hash: `/entry/demo/pages:nl/${ferris}`,
    async prepare(page) {
      await page.getByRole('tab', {name: 'Preview'}).click()
    }
  },
  {
    name: 'dashboard-stock',
    alt: 'A custom stock overview panel in the pricing tab, calculated from the price and finishes of the product',
    hash: `/entry/demo/pages:en/${ferris}`,
    async prepare(page) {
      await page.getByRole('tab', {name: 'Pricing & stock'}).click()
    }
  },
  {
    name: 'dashboard-references',
    alt: 'The references panel listing the pages that link to this product',
    hash: `/entry/demo/pages:en/${ferris}`,
    async prepare(page) {
      await page.getByRole('tab', {name: 'References'}).click()
    }
  },
  {
    name: 'dashboard-history',
    alt: 'The history panel listing earlier published versions of the product',
    hash: `/entry/demo/pages:en/${ferris}`,
    async prepare(page) {
      await page.getByRole('tab', {name: 'History'}).click()
    }
  },
  // Four demo users leave a full window mostly empty, use a smaller one
  {
    name: 'dashboard-roles',
    alt: 'The users screen with an admin, editor, translator and viewer, each with their role',
    hash: '/users',
    viewport: {width: 1200, height: 420}
  },
  {
    name: 'dashboard-home-builder',
    alt: 'The home page built from blocks, with the hero block open and the page previewed beside it',
    hash: `/entry/demo/pages:en/${home}`,
    async prepare(page) {
      await page.getByRole('tab', {name: 'Preview'}).click()
    }
  },
  {
    name: 'dashboard-media',
    alt: 'The media library showing a grid of product and interior photos',
    hash: '/entry/demo/media'
  },
  {
    name: 'dashboard-search',
    alt: 'Searching all content for "dining", showing matching products, a collection, an article and images',
    hash: `/entry/demo/pages:en/${ferris}`,
    async prepare(page) {
      await page.getByRole('button', {name: 'Search entries'}).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('radio', {name: 'Card view'}).click()
      await dialog.getByRole('searchbox').fill('dining')
    }
  }
]

const baseUrl = process.env.SCREENSHOTS_BASE_URL ?? 'http://localhost:3000'
const mcpUrl = process.env.ALINEA_MCP_URL ?? 'http://localhost:4500/mcp'
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(webDir, '.cache/screenshots')
const defaultViewport = {width: 1600, height: 1000}
const maxBytes = 500 * 1024
const mediaFolder = 'Screenshots'

// Hide dev-only overlays and the text caret so captures are identical
const captureCss = `
  nextjs-portal { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`

/** Waits until the dashboard shows no loaders, images and fonts are loaded
 * and the DOM stopped changing */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    () => {
      const busy = document.querySelector(
        '[data-slot="spinner"], [role="progressbar"], [aria-busy="true"]'
      )
      if (busy) return false
      // Lazy images outside the viewport never load, only check visible ones
      return Array.from(document.images).every(image => {
        const rect = image.getBoundingClientRect()
        const visible =
          rect.width > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth
        if (!visible) return true
        return image.complete && (image.naturalWidth > 0 || !image.src)
      })
    },
    undefined,
    {timeout: 30_000}
  )
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // Resolves once nothing changed in the DOM for 500ms
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        let timer = setTimeout(done, 500)
        const observer = new MutationObserver(() => {
          clearTimeout(timer)
          timer = setTimeout(done, 500)
        })
        function done() {
          observer.disconnect()
          resolve()
        }
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true
        })
      })
  )
}

/** Moves the pointer off the page and clears focus rings */
async function calm(page: Page, keepFocus: boolean) {
  await page.mouse.move(defaultViewport.width - 1, 0)
  await page.mouse.move(-1, -1)
  if (!keepFocus)
    await page.evaluate(() => {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    })
}

/** Encodes a PNG as WebP in the browser, lowering quality to fit maxBytes */
async function toWebp(encoder: Page, png: Buffer) {
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`
  for (const quality of [0.9, 0.85, 0.8, 0.75, 0.7, 0.6]) {
    const webp = await encoder.evaluate(
      async ({dataUrl, quality}) => {
        const image = new Image()
        image.src = dataUrl
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        canvas.getContext('2d')!.drawImage(image, 0, 0)
        return canvas.toDataURL('image/webp', quality)
      },
      {dataUrl, quality}
    )
    const bytes = Buffer.from(webp.slice(webp.indexOf(',') + 1), 'base64')
    if (bytes.length <= maxBytes || quality === 0.6) return bytes
  }
  throw new Error('unreachable')
}

async function capture(
  browser: Browser,
  encoder: Page,
  shot: Shot,
  scheme: Scheme
) {
  const viewport = shot.viewport ?? defaultViewport
  // A fresh context per shot starts with an empty sessionStorage, which
  // resets the demo session to the committed content
  const context: BrowserContext = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    colorScheme: scheme,
    locale: 'en-US',
    timezoneId: 'Europe/Brussels'
  })
  try {
    const page = await context.newPage()
    await page.addInitScript(() => sessionStorage.clear())
    await page.goto(`${baseUrl}/demo?screenshot#${shot.hash}`)
    await page.addStyleTag({content: captureCss})
    await page.locator('[data-slot="demo-reset"]').waitFor({state: 'detached'})
    await settle(page)
    if (shot.prepare) {
      await shot.prepare(page)
      await settle(page)
    }
    await calm(page, shot.name === 'dashboard-search')
    await settle(page)
    const png = await page.screenshot({animations: 'disabled'})
    const webp = await toWebp(encoder, png)
    const file = path.join(outDir, fileName(shot.name, scheme))
    await writeFile(file, webp)
    console.log(
      `✓ ${path.relative(webDir, file)} ${Math.round(webp.length / 1024)} KB`
    )
    const result: Capture = {
      file,
      alt: shot.alt,
      width: viewport.width * 2,
      height: viewport.height * 2
    }
    return result
  } finally {
    await context.close()
  }
}

interface Capture {
  file: string
  alt: string
  width: number
  height: number
}

function fileName(name: string, scheme: Scheme) {
  return scheme === 'light' ? `${name}.webp` : `${name}-dark.webp`
}

// --- Publishing through the alinea dev MCP server ---

interface ToolContent {
  type: string
  text?: string
}

interface ToolResult {
  content?: Array<ToolContent>
  isError?: boolean
}

interface RpcResponse {
  result?: ToolResult
  error?: {message: string}
}

let rpcId = 0
async function mcp<T>(name: string, args: Record<string, unknown>) {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: {name, arguments: args}
    })
  })
  if (!response.ok)
    throw new Error(`MCP ${name}: ${response.status} ${response.statusText}`)
  const body = (await response.json()) as RpcResponse
  if (body.error) throw new Error(`MCP ${name}: ${body.error.message}`)
  const text = body.result?.content?.map(part => part.text ?? '').join('\n')
  if (body.result?.isError) throw new Error(`MCP ${name}: ${text}`)
  return JSON.parse(text ?? 'null') as T
}

interface EntrySummary {
  id: string
  title: string
  type: string
  parentId: string | null
}

interface FindResult {
  entries: Array<EntrySummary>
}

interface MediaData {
  location: string
  width: number
  height: number
}

interface MediaEntry {
  id: string
  data: MediaData
}

interface UploadResult {
  id: string
}

async function screenshotsFolder() {
  const {entries} = await mcp<FindResult>('find_entries', {
    workspace: 'main',
    root: 'media',
    type: 'MediaLibrary',
    search: mediaFolder
  })
  const folder = entries.find(entry => entry.title === mediaFolder)
  if (folder) return folder.id
  const created = await mcp<UploadResult>('create_entry', {
    type: 'MediaLibrary',
    workspace: 'main',
    root: 'media',
    data: {title: mediaFolder}
  })
  return created.id
}

async function publish(item: Capture, folderId: string) {
  const title = path.basename(item.file, path.extname(item.file))
  const {entries} = await mcp<FindResult>('find_entries', {
    workspace: 'main',
    root: 'media',
    parentId: folderId,
    search: title
  })
  const existing = entries.find(entry => entry.title === title)
  if (!existing) {
    const upload = await mcp<UploadResult>('upload_file', {
      path: path.relative(webDir, item.file),
      workspace: 'main',
      parentId: folderId,
      title
    })
    await mcp('update_entry', {id: upload.id, data: {alt: item.alt}})
    console.log(`↑ ${title} → ${upload.id}`)
    return
  }
  // The MCP server cannot replace the file of an existing media entry
  // (upload_file always creates a new entry and update_entry only accepts
  // title, alt and focus on media). To keep the entry id and path that pages
  // reference, write the new capture over the existing file. Captures have a
  // fixed size so the stored width and height stay correct; the blur
  // preview is left from the first upload.
  const current = await mcp<MediaEntry>('get_entry', {id: existing.id})
  const {width, height} = item
  if (current.data.width !== width || current.data.height !== height)
    throw new Error(
      `${title} changed size (${current.data.width}x${current.data.height} → ` +
        `${width}x${height}), delete media entry ${existing.id} and publish ` +
        'again, then point the pages that used it to the new entry'
    )
  await writeFile(
    path.join(webDir, 'public', current.data.location),
    await readFile(item.file)
  )
  await mcp('update_entry', {id: existing.id, data: {alt: item.alt}})
  console.log(`↻ ${title} → ${existing.id}`)
}

// --- Main ---

const args = process.argv.slice(2)
const shouldPublish = args.includes('--publish')
const schemeIndex = args.indexOf('--scheme')
const schemes: Array<Scheme> =
  schemeIndex >= 0 ? [args[schemeIndex + 1] as Scheme] : ['light', 'dark']
const names = args.filter(
  (arg, index) => !arg.startsWith('--') && args[index - 1] !== '--scheme'
)
const selected = names.length
  ? shots.filter(shot => names.includes(shot.name))
  : shots
if (names.length && selected.length !== names.length) {
  const known = shots.map(shot => shot.name).join(', ')
  throw new Error(`Unknown shot name, choose from: ${known}`)
}

await mkdir(outDir, {recursive: true})
const browser = await chromium.launch()
const captures: Array<Capture> = []
try {
  const encoder = await (await browser.newContext()).newPage()
  for (const shot of selected)
    for (const scheme of schemes)
      captures.push(await capture(browser, encoder, shot, scheme))
} finally {
  await browser.close()
}

if (shouldPublish) {
  const folderId = await screenshotsFolder()
  for (const item of captures) await publish(item, folderId)
}
