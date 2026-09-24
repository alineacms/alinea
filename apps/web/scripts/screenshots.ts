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
 * so re-running replaces the image while the entry id stays the same and
 * pages that reference it pick up the new capture. A renamed shot finds its
 * entry by its previous name.
 *
 * Pass shot names to publish a subset, eg. only the ones the site uses:
 *   bun screenshots --publish dashboard-product dashboard-translations \
 *     dashboard-stock dashboard-roles dashboard-overview
 *
 * Every shot waits for concrete elements rather than fixed delays, so a run
 * fails with the name of the shot when the dashboard changed underneath it.
 */

import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Locator,
  type Page
} from 'playwright'

type Scheme = 'light' | 'dark'

interface Clip {
  x: number
  y: number
  width: number
  height: number
}

interface Shot {
  name: string
  /** Dashboard location, the part after `#` */
  hash: string
  /** Alt text of the published media entry */
  alt: string
  viewport?: {width: number; height: number}
  /** Capture only this region of the viewport, in CSS pixels */
  clip?: Clip
  /** Earlier name of the shot, its media entry is reused when renamed */
  previousName?: string
  /** Keep keyboard focus where prepare left it, eg. in an open menu */
  keepFocus?: boolean
  /** Waits for an element that shows the location finished loading */
  ready(page: Page): Locator
  /** Bring the dashboard into the state to capture, then wait until it shows
   * that state */
  prepare?(page: Page): Promise<void>
}

const ferris = '3JjYg1RR8ghz3NENJTrtX2QiHgP'
const home = '3JjYg2xcgCGTqmAoAf36mA6hWqR'
const products = '3JjYfwD09WF5vKYfXObPiZGMUOI'

/** Opens a tab of the entry editor or its side panel */
async function openTab(page: Page, name: string) {
  const tab = page.getByRole('tab', {name, exact: true})
  await tab.click()
  await expectAttribute(tab, 'aria-selected', 'true')
}

/** Waits until the element has the attribute value, eg. is selected */
async function expectAttribute(locator: Locator, name: string, value: string) {
  await locator.and(locator.page().locator(`[${name}="${value}"]`)).waitFor()
}

/** The product page rendered in the preview panel */
function previewHeading(page: Page, title: string) {
  return page.getByRole('heading', {name: title, level: 1}).last()
}

const shots: Array<Shot> = [
  {
    name: 'dashboard-product',
    alt: 'The Alinea dashboard editing a product, with a live preview of the page beside the form',
    hash: `/entry/demo/pages:en/${ferris}`,
    ready: page => page.getByRole('tab', {name: 'Preview'}),
    async prepare(page) {
      await openTab(page, 'Preview')
      await previewHeading(page, 'Ferris Dining Table').waitFor()
    }
  },
  {
    name: 'dashboard-translations',
    previousName: 'dashboard-localiser',
    alt: 'The Dutch translation of a product, with the language menu open to switch between English, Dutch and French',
    hash: `/entry/demo/pages:nl/${ferris}`,
    keepFocus: true,
    ready: page => page.getByRole('tab', {name: 'Preview'}),
    async prepare(page) {
      await openTab(page, 'Preview')
      await page
        .getByText('Een massief eiken tafel voor lange diners')
        .last()
        .waitFor()
      await page.getByRole('button', {name: 'Language'}).first().click()
      await page
        .getByRole('menu', {name: 'Language'})
        .getByRole('menuitemradio', {name: 'NL Dutch'})
        .waitFor()
    }
  },
  {
    name: 'dashboard-overview',
    alt: 'The products overview, a table with a thumbnail, price, material and stock for every product, sorted by price',
    hash: `/entry/demo/pages:en/${products}`,
    // Nine products fill the table, a taller window only adds empty space
    viewport: {width: 1280, height: 560},
    ready: page => page.getByRole('treegrid', {name: 'Explorer entries'}),
    async prepare(page) {
      const price = page.getByRole('button', {name: 'Price', exact: true})
      // The first click sorts ascending, the second descending
      await price.click()
      await page.getByText('Sorted by Price').waitFor()
      await price.click()
      await page
        .getByRole('treegrid', {name: 'Explorer entries'})
        .getByRole('row')
        .first()
        .filter({hasText: 'Linden Sideboard'})
        .waitFor()
    }
  },
  {
    name: 'dashboard-stock',
    alt: 'A custom stock overview panel in the pricing tab, calculated from the price and finishes of the product',
    hash: `/entry/demo/pages:en/${ferris}`,
    ready: page => page.getByRole('tab', {name: 'Pricing & stock'}),
    async prepare(page) {
      await openTab(page, 'Preview')
      await openTab(page, 'Pricing & stock')
      await page.getByText('Units in stock').waitFor()
    }
  },
  {
    name: 'dashboard-references',
    alt: 'The references panel listing the pages that link to this product',
    hash: `/entry/demo/pages:en/${ferris}`,
    ready: page => page.getByRole('tab', {name: 'References'}),
    async prepare(page) {
      await openTab(page, 'References')
      await page.getByText(/references in other languages/).waitFor()
    }
  },
  {
    name: 'dashboard-history',
    alt: 'The history panel listing earlier published versions of the product',
    hash: `/entry/demo/pages:en/${ferris}`,
    ready: page => page.getByRole('tab', {name: 'History'}),
    async prepare(page) {
      await openTab(page, 'History')
      await page.getByText('Previous versions').waitFor()
    }
  },
  // Four demo users leave a full window mostly empty, use a smaller one
  {
    name: 'dashboard-roles',
    alt: 'The users screen with an admin, editor, translator and viewer, each with their role',
    hash: '/users',
    viewport: {width: 1280, height: 400},
    ready: page => page.getByText('Viewer', {exact: true}).first()
  },
  {
    name: 'dashboard-home-builder',
    alt: 'The home page built from blocks, with the hero block open and the page previewed beside it',
    hash: `/entry/demo/pages:en/${home}`,
    ready: page => page.getByRole('tab', {name: 'Preview'}),
    async prepare(page) {
      await openTab(page, 'Preview')
      await page.getByText('Shop the collection').last().waitFor()
    }
  },
  {
    name: 'dashboard-media',
    alt: 'The media library showing a grid of product and interior photos',
    hash: '/entry/demo/media',
    ready: page => page.getByRole('grid', {name: 'Explorer entries'})
  },
  {
    name: 'dashboard-search',
    alt: 'Searching all content for "dining", showing matching products, a collection, an article and images',
    hash: `/entry/demo/pages:en/${ferris}`,
    // Six results fill two rows of cards, a shorter window keeps the dialog
    // from showing mostly empty space
    viewport: {width: 1280, height: 600},
    keepFocus: true,
    ready: page => page.getByRole('button', {name: 'Search entries'}),
    async prepare(page) {
      // Search opens from the icon button in the sidebar or with ⌘K
      await page.getByRole('button', {name: 'Search entries'}).click()
      const dialog = page.getByRole('dialog', {name: 'Search entries'})
      const cards = dialog.getByRole('radio', {name: 'Card view'})
      await cards.click()
      await expectAttribute(cards, 'aria-checked', 'true')
      await dialog.getByRole('combobox', {name: 'Search'}).fill('dining')
      await dialog.getByText('Inside our Ghent workshop').waitFor()
    }
  }
]

const baseUrl = process.env.SCREENSHOTS_BASE_URL ?? 'http://localhost:3000'
const mcpUrl = process.env.ALINEA_MCP_URL ?? 'http://localhost:4500/mcp'
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(webDir, '.cache/screenshots')
// A laptop sized window, small enough that the interface reads well when the
// capture is scaled down on the site
const defaultViewport = {width: 1280, height: 800}
const maxBytes = 500 * 1024
const mediaFolder = 'Screenshots'

// Hide dev-only overlays and the text caret so captures are identical
const captureCss = `
  nextjs-portal { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`

/** Waits until the dashboard shows no loaders, images and fonts are loaded
 * and the DOM stopped changing. The dev server keeps connections open while
 * it compiles, so this checks the page rather than waiting for network idle */
async function settle(page: Page) {
  await page.waitForLoadState('load')
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
  await page.mouse.move(page.viewportSize()!.width - 1, 0)
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
    try {
      await shot.ready(page).waitFor({timeout: 60_000})
    } catch (error) {
      throw new Error(
        `${shot.name}: the dashboard did not render at ${page.url()}, ` +
          'check the dev server for build errors',
        {cause: error}
      )
    }
    await settle(page)
    if (shot.prepare) {
      await shot.prepare(page)
      await settle(page)
    }
    await calm(page, shot.keepFocus ?? false)
    await settle(page)
    const png = await page.screenshot({animations: 'disabled', clip: shot.clip})
    const webp = await toWebp(encoder, png)
    const file = path.join(outDir, fileName(shot.name, scheme))
    await writeFile(file, webp)
    console.log(
      `✓ ${path.relative(webDir, file)} ${Math.round(webp.length / 1024)} KB`
    )
    const result: Capture = {
      file,
      previousTitle: shot.previousName
        ? path.basename(fileName(shot.previousName, scheme), '.webp')
        : undefined,
      alt: shot.alt
    }
    return result
  } finally {
    await context.close()
  }
}

interface Capture {
  file: string
  /** Title of the media entry of an earlier name of the shot */
  previousTitle?: string
  alt: string
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

async function findMedia(folderId: string, title: string) {
  const {entries} = await mcp<FindResult>('find_entries', {
    workspace: 'main',
    root: 'media',
    parentId: folderId,
    search: title
  })
  return entries.find(entry => entry.title === title)
}

async function publish(item: Capture, folderId: string) {
  const title = path.basename(item.file, path.extname(item.file))
  const existing =
    (await findMedia(folderId, title)) ??
    (item.previousTitle
      ? await findMedia(folderId, item.previousTitle)
      : undefined)
  const file = path.relative(webDir, item.file)
  if (!existing) {
    const upload = await mcp<UploadResult>('upload_file', {
      path: file,
      workspace: 'main',
      parentId: folderId,
      title,
      alt: item.alt
    })
    console.log(`↑ ${title} → ${upload.id}`)
    return
  }
  // Replace the file of the existing media entry, so its id stays the same
  // and pages that reference it pick up the new capture
  await mcp<UploadResult>('upload_file', {
    path: file,
    replace: existing.id,
    title,
    alt: item.alt
  })
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
