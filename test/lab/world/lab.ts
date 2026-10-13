/**
 * The lab as a whole: its settings, the actions the view offers and the
 * baseline every scenario starts from.
 */
import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {chunkCookieValue} from '#/preview/ChunkCookieValue.js'
import {PREVIEW_COOKIE_NAME} from '#/preview/PreviewCookies.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {type ConfigVersion, labConfig} from '../shared/schema.js'
import {type BackendDriver, backendDb} from './backendDb.js'
import {type Browser, browsers, resetUsers, type Tab} from './browsers.js'
import {bus} from './bus.js'
import {clock} from './clock.js'
import {pageIds, pushTitle, seedRepository} from './content.js'
import {dataCache} from './dataCache.js'
import {type BackendMode, deployments} from './deployments.js'
import {github} from './github.js'
import {network} from './network.js'
import './cloud.js'

export interface Rendered {
  node: string
  slot: number
  pages: Array<{id: string; title: string; path: string; body: string}>
  sha?: string
  draft: boolean
  ms: number
  at: number
  error?: string
}

const decoder = new TextDecoder()

class Lab {
  mode: BackendMode = 'self-hosted'
  rendered: Record<string, Rendered | undefined> = {}
  busy = false

  get browsers() {
    return browsers
  }

  browser(id: string): Browser {
    const found = browsers.find(b => b.id === id)
    if (!found) throw new Error(`No browser ${id}`)
    return found
  }

  /** A fresh world: one commit on the branch, one deployment, no browsers. */
  async reset(options: {mode?: BackendMode; driver?: BackendDriver} = {}) {
    this.mode = options.mode ?? this.mode
    backendDb.driver = options.driver ?? backendDb.driver
    for (const browser of browsers) await browser.clearStorage()
    resetUsers()
    for (const deployment of deployments.list) deployments.retire(deployment)
    deployments.list = []
    deployments.routing = 'alternate'
    for (const node of Object.keys(network.faults))
      network.faults[node] = undefined
    await backendDb.reset()
    dataCache.entries.clear()
    this.rendered = {}
    bus.states = {}
    bus.clear()
    const commit = await seedRepository()
    await deployments.build(commit, 1, this.mode)
    bus.log({
      node: 'lab',
      kind: 'reset',
      text: `fresh world: ${this.mode} backend`
    })
  }

  /** Request a page of the site, as a visitor or a draft previewer would. */
  async visit(
    options: {
      node?: string
      slot?: number
      draft?: boolean
      cookies?: Array<{name: string; value: string}>
    } = {}
  ): Promise<Rendered> {
    const node = options.node ?? 'visitor'
    const slot = options.slot ?? deployments.pick()
    const realm = deployments.isolate(slot)
    const to = deployments.isolateNode(slot)
    const label = options.draft ? 'GET / (draft)' : 'GET /'
    bus.send({
      from: node,
      to,
      label,
      duration: network.latency,
      kind: 'request'
    })
    await network.delay()
    const start = performance.now()
    let rendered: Rendered
    try {
      const page = await network.call<
        Omit<Rendered, 'node' | 'slot' | 'draft' | 'at'>
      >(realm, 'render', {
        path: '/',
        draft: options.draft,
        cookies: options.cookies
      })
      rendered = {
        ...page,
        node: to,
        slot,
        draft: Boolean(options.draft),
        at: bus.now()
      }
    } catch (error) {
      rendered = {
        node: to,
        slot,
        pages: [],
        draft: Boolean(options.draft),
        ms: Math.round(performance.now() - start),
        at: bus.now(),
        error: error instanceof Error ? error.message : String(error)
      }
    }
    bus.send({
      from: to,
      to: node,
      label: rendered.error ? '500' : '200 html',
      duration: network.latency,
      kind: rendered.error ? 'error' : 'response'
    })
    await network.delay()
    this.rendered[node] = rendered
    bus.log({
      node,
      kind: 'render',
      text: rendered.error
        ? `render on λ${slot + 1} failed: ${rendered.error}`
        : `rendered on λ${slot + 1} at ${rendered.sha?.slice(0, 7)}: ${rendered.pages.map(p => p.title).join(' · ')}`
    })
    return rendered
  }

  /**
   * Preview an edit that is not saved: the dashboard sends the change as a
   * patch against the content it shows, and the site renders a draft with it.
   */
  async preview(browser: Browser, tab: Tab, id: string, title: string) {
    const config = labConfig(tab.configVersion)
    const entry = (await tab.graph.first({
      select: Entry,
      id,
      locale: null,
      status: 'preferDraft'
    })) as Entry | null
    if (!entry) throw new Error('Entry not found')
    const format = (value: Entry) =>
      decoder.decode(
        JsonLoader.format(config.schema, createRecord(value, value.status))
      )
    const next = {...entry, title, data: {...entry.data, title}}
    const payload = await encodePreviewPayload({
      locale: entry.locale,
      entryId: entry.id,
      contentHash: await tab.graph.sha,
      status: entry.status,
      patch: await createFilePatch(format(entry), format(next))
    })
    bus.log({
      node: tab.node,
      kind: 'preview',
      text: `${tab.label} previews "${title}": patch of ${payload.length} chars against ${(await tab.graph.sha).slice(0, 7)}`
    })
    return this.visit({
      node: 'preview',
      draft: true,
      cookies: chunkCookieValue(PREVIEW_COOKIE_NAME, payload)
    })
  }

  async developerPush(key = 'about', title?: string) {
    const id = pageIds[key]
    const next =
      title ?? `About (pushed ${new Date(bus.now()).toLocaleTimeString()})`
    bus.log({
      node: 'developer',
      kind: 'push',
      text: `developer pushes "${next}" to the branch`
    })
    bus.send({
      from: 'developer',
      to: 'github',
      label: 'git push',
      duration: network.latency,
      kind: 'request'
    })
    await network.delay()
    return pushTitle(id, next, `Edit ${key} in the repository`)
  }

  /** Push code that changes the config: a deploy then ships it. */
  async pushConfig(version: ConfigVersion) {
    bus.log({
      node: 'developer',
      kind: 'push',
      text: `developer pushes config v${version}${version === 2 ? ' (adds a summary field)' : ''}`
    })
    bus.send({
      from: 'developer',
      to: 'github',
      label: 'git push',
      duration: network.latency,
      kind: 'request'
    })
    await network.delay()
    return github.push([], `Config v${version}`, 'developer', version)
  }

  async deploy() {
    const head = github.head
    bus.send({
      from: 'github',
      to: 'build',
      label: 'webhook',
      duration: network.latency,
      kind: 'event'
    })
    await network.delay()
    return deployments.build(head, head.configVersion, this.mode)
  }

  advance(seconds: number) {
    clock.advance(seconds * 1000)
  }
}

export const lab = new Lab()
