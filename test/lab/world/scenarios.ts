/**
 * One-click scenarios. Each sets up the world it needs, plays a story through
 * the real code and checks what every node ends up with.
 */
import type {Activity} from '#/dashboard/boot/ActivityEvent.js'
import {labConfig} from '../shared/schema.js'
import {backendDb} from './backendDb.js'
import type {Browser, Tab} from './browsers.js'
import {bus, type LogEvent} from './bus.js'
import {pageIds} from './content.js'
import {dataCache} from './dataCache.js'
import {deployments} from './deployments.js'
import {github} from './github.js'
import {lab} from './lab.js'
import {network} from './network.js'

export type CheckKind = 'pass' | 'fail' | 'info' | 'finding'

export interface Check {
  label: string
  kind: CheckKind
  detail?: string
}

export interface ScenarioRun {
  status: 'running' | 'done' | 'error'
  step?: string
  checks: Array<Check>
  error?: string
  startedAt: number
  /** First event of the run, to show its log. */
  fromEvent: number
}

export interface Scenario {
  id: string
  title: string
  group: string
  summary: string
  run(ctx: Context): Promise<void>
}

export class Context {
  run: ScenarioRun
  #since: number

  constructor(run: ScenarioRun) {
    this.run = run
    this.#since = run.fromEvent
  }

  step(text: string) {
    this.run.step = text
    bus.log({node: 'scenario', kind: 'step', text: `▸ ${text}`})
  }

  check(label: string, ok: boolean, detail?: string) {
    this.run.checks.push({label, kind: ok ? 'pass' : 'fail', detail})
    bus.changed()
    return ok
  }

  info(label: string, detail?: string) {
    this.run.checks.push({label, kind: 'info', detail})
    bus.changed()
  }

  /** Behavior that holds, but looks unintended: worth a look upstream. */
  finding(label: string, detail?: string) {
    this.run.checks.push({label, kind: 'finding', detail})
    bus.changed()
  }

  /** Events logged since `mark()`, or since the run started. */
  events(filter?: (event: LogEvent) => boolean): Array<LogEvent> {
    return bus.events.filter(e => e.id >= this.#since && (!filter || filter(e)))
  }

  mark() {
    this.#since = (bus.events[bus.events.length - 1]?.id ?? 0) + 1
  }

  requests(from: string, label: string) {
    return this.events(
      e =>
        e.kind === 'http' &&
        (e.detail as {from?: string})?.from === from &&
        String((e.detail as {label?: string})?.label).includes(label)
    )
  }

  async waitFor(
    condition: () => boolean | Promise<boolean>,
    label: string,
    timeout = 30_000
  ) {
    const start = performance.now()
    while (performance.now() - start < timeout) {
      if (await condition()) return true
      await sleep(100)
    }
    this.run.checks.push({label: `timed out: ${label}`, kind: 'fail'})
    return false
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const head = () => github.head.contentSha
const short = (sha?: string) => sha?.slice(0, 7) ?? '—'

function title(tab: Tab, key: string) {
  return tab.entries.find(e => e.id === pageIds[key])?.title
}

function headTitle(key: string) {
  for (const {path} of github.files()) {
    const record = JSON.parse(github.read(path)!)
    if (record._id === pageIds[key]) return record.title as string
  }
}

function renderedTitle(node: string, key: string) {
  return lab.rendered[node]?.pages.find(p => p.id === pageIds[key])?.title
}

function lastActivity(tab: Tab): Activity | undefined {
  return tab.activities.find(a => a.type === 'mutation')
}

/** Open a tab and wait until it shows the content. */
async function openTab(ctx: Context, browser: Browser) {
  const tab = await browser.openTab()
  await ctx.waitFor(() => tab.ready, `${tab.label} of ${browser.node} ready`)
  return tab
}

async function settled(ctx: Context, browser: Browser, tab: Tab) {
  await ctx.waitFor(async () => {
    await browser.refresh(tab)
    const activity = lastActivity(tab)
    return (
      !activity ||
      ['succeeded', 'failed', 'blocked', 'cancelled', 'discarded'].includes(
        activity.status
      )
    )
  }, 'save settled')
  return lastActivity(tab)
}

/** Wait until a pages instance refreshed the content sha the renders share. */
async function shaRefreshed(ctx: Context) {
  return ctx.waitFor(
    () =>
      [...dataCache.entries.values()].some(
        entry => entry.value === head() && !dataCache.isStale(entry)
      ),
    'the cached content sha is refreshed'
  )
}

const [a, b] = lab.browsers

export const scenarios: Array<Scenario> = [
  {
    id: 'cold-visit',
    group: 'Site',
    title: 'First visit after a deploy',
    summary:
      'A pages instance starts cold on the generated database, asks the shared data cache for the content sha, misses, and asks the handler, which syncs with git.',
    async run(ctx) {
      await lab.reset()
      ctx.step('A visitor requests the site')
      const page = await lab.visit({slot: 0})
      ctx.check(
        'page renders from the cms copy of the generated database',
        page.pages.length === 3
      )
      const state = bus.states['pages-1']
      ctx.check(
        'the pages instance answered from its own copy of the generated database',
        Boolean(state?.shas?.pages),
        JSON.stringify(state?.shas)
      )
      ctx.check(
        'the data cache now holds the content sha for 60s',
        [...dataCache.entries.values()].some(e => e.value === head()),
        short(head())
      )
      ctx.check(
        'the render is at the head of the branch',
        page.sha === head(),
        `${short(page.sha)} vs ${short(head())}`
      )
      ctx.mark()
      ctx.step('A second visit within the window reads the cached sha')
      await lab.visit({slot: 0})
      ctx.check(
        'no request reaches the handler for the sha',
        ctx.requests('pages-1', 'GET sha').length === 0
      )
    }
  },
  {
    id: 'open-dashboard',
    group: 'Dashboard',
    title: 'Open the dashboard in a new browser',
    summary:
      'An empty browser store syncs everything through the handler: the tree, then blobs, which the handler answers from the backend database or git. The store saves a base in IndexedDB.',
    async run(ctx) {
      await lab.reset()
      ctx.step(
        'Ada opens the dashboard: the shared worker starts on an empty store'
      )
      const tab = await openTab(ctx, a)
      ctx.check('the tab shows the three pages', tab.entries.length === 3)
      ctx.check(
        'the worker store is at the head',
        tab.sha === head(),
        short(tab.sha)
      )
      ctx.check(
        'the worker asked for the tree',
        ctx.requests(a.worker, 'tree').length > 0
      )
      ctx.check(
        'then downloaded the blobs',
        ctx.requests(a.worker, 'blob').length > 0
      )
      await ctx.waitFor(async () => {
        await a.inspectStorage()
        return (bus.states[a.node]?.bases?.length ?? 0) > 0
      }, 'a base is stored')
      ctx.check(
        'a base of the content is stored in IndexedDB',
        (bus.states[a.node]?.bases?.length ?? 0) > 0
      )
    }
  },
  {
    id: 'reopen-dashboard',
    group: 'Dashboard',
    title: 'Reopen the browser: stored content first',
    summary:
      'A store with a stored base shows it right away and catches up as an activity. Content pushed meanwhile arrives with the catch-up sync, as a delta.',
    async run(ctx) {
      await lab.reset()
      ctx.step('Ada opens the dashboard once, then quits the browser')
      await openTab(ctx, a)
      await ctx.waitFor(async () => {
        await a.inspectStorage()
        return (bus.states[a.node]?.bases?.length ?? 0) > 0
      }, 'a base is stored')
      a.quit()
      ctx.step('A developer pushes a change while the browser is closed')
      await lab.developerPush('about', 'About (while away)')
      ctx.mark()
      ctx.step('Ada opens the dashboard again')
      const tab = await openTab(ctx, a)
      ctx.check(
        'the worker opened the stored base',
        ctx.events(
          e => e.node === a.worker && e.text.startsWith('opened stored base')
        ).length > 0
      )
      ctx.check(
        'the catch-up sync ran as an activity',
        ctx.events(e => e.node === a.worker && e.kind === 'syncWith').length >
          0 || tab.activities.some(x => x.type === 'sync')
      )
      await ctx.waitFor(async () => {
        await a.refresh(tab)
        return title(tab, 'about') === 'About (while away)'
      }, 'the pushed title arrives')
      ctx.check(
        'the pushed change arrived',
        title(tab, 'about') === 'About (while away)'
      )
      const blobs = ctx.requests(a.worker, 'blob')
      ctx.check(
        'only the changed file was downloaded',
        blobs.length <= 1,
        `${blobs.length} blob request(s)`
      )
    }
  },
  {
    id: 'save',
    group: 'Edit',
    title: 'An editor saves',
    summary:
      'The worker applies the edit to its own store first (the tab updates at once), then the handler plans the commit on its store, commits it to git, keeps the blob, and revalidates the content sha tag.',
    async run(ctx) {
      await lab.reset()
      const a1 = await openTab(ctx, a)
      const a2 = await openTab(ctx, a)
      const b1 = await openTab(ctx, b)
      const before = github.commits.length
      ctx.mark()
      ctx.step('Ada renames Home in her first tab')
      await a.save(a1, pageIds.home, 'Home, edited by Ada')
      ctx.check(
        'the tab shows the edit right away',
        title(a1, 'home') === 'Home, edited by Ada'
      )
      await ctx.waitFor(async () => {
        await a.refresh(a2)
        return title(a2, 'home') === 'Home, edited by Ada'
      }, 'second tab updates')
      ctx.check(
        "Ada's second tab updates through the shared worker",
        title(a2, 'home') === 'Home, edited by Ada'
      )
      const activity = await settled(ctx, a, a1)
      ctx.check(
        'the save activity succeeded',
        activity?.status === 'succeeded',
        activity?.status
      )
      ctx.check(
        'one commit landed on the branch',
        github.commits.length === before + 1
      )
      ctx.check(
        "the worker's optimistic sha equals the commit's content sha",
        a1.sha === head(),
        `${short(a1.sha)} vs ${short(head())}`
      )
      ctx.check(
        'the handler stored the committed blob in the backend database',
        ctx.events(
          e =>
            e.node === backendDb.node && e.text.includes('insert alinea_blob')
        ).length > 0
      )
      ctx.check(
        'the handler revalidated the content sha tag',
        ctx.events(e => e.kind === 'revalidate').length > 0
      )
      await b.refresh(b1)
      ctx.check(
        "Grace's browser still shows the old title",
        title(b1, 'home') === 'Home'
      )
      ctx.step('Grace syncs (her worker does every 120s)')
      await b.sync(b1)
      ctx.check(
        "Grace's browser shows the edit after a sync",
        title(b1, 'home') === 'Home, edited by Ada'
      )
    }
  },
  {
    id: 'visit-after-save',
    group: 'Site',
    title: 'Visitors after a save',
    summary:
      'A commit marks the cached content sha stale. The next render still reads the stale sha and refreshes it in the background; the render after that syncs and shows the edit.',
    async run(ctx) {
      await lab.reset()
      ctx.step('Both pages instances serve a visitor once')
      await lab.visit({slot: 0})
      await lab.visit({slot: 1})
      const tab = await openTab(ctx, a)
      ctx.step('Ada saves')
      await a.save(tab, pageIds.home, 'Home, saved')
      await settled(ctx, a, tab)
      ctx.step('A visitor hits pages λ2')
      const first = await lab.visit({slot: 1})
      const firstTitle = renderedTitle('visitor', 'home')
      if (firstTitle === 'Home')
        ctx.info(
          'the first render after the commit was stale',
          'stale-while-revalidate on the content sha, as documented in syncCheck.ts'
        )
      else ctx.info('the first render after the commit was fresh')
      void first
      await shaRefreshed(ctx)
      ctx.check('in the background pages λ2 refreshed the cached sha', true)
      ctx.step('Another visitor hits pages λ2')
      await lab.visit({slot: 1})
      ctx.check(
        'the next render shows the edit',
        renderedTitle('visitor', 'home') === 'Home, saved'
      )
      ctx.step('And pages λ1')
      await lab.visit({slot: 0})
      ctx.check(
        'pages λ1 serves the edit too',
        renderedTitle('visitor', 'home') === 'Home, saved'
      )
    }
  },
  {
    id: 'developer-push',
    group: 'Git',
    title: 'A developer pushes content to git',
    summary:
      'No handler sees this commit. Renders notice it once the cached sha expires (syncInterval, 60s here), dashboards with their interval sync (120s).',
    async run(ctx) {
      await lab.reset()
      await lab.visit({slot: 0})
      const tab = await openTab(ctx, a)
      ctx.step('The developer pushes a new About title')
      await lab.developerPush('about', 'About, from git')
      await lab.visit({slot: 0})
      ctx.check(
        'within the window the site still shows the old title',
        renderedTitle('visitor', 'about') === 'About'
      )
      ctx.step('⏩ 61 seconds later')
      lab.advance(61)
      await lab.visit({slot: 0})
      const stale = renderedTitle('visitor', 'about') === 'About'
      ctx.info(
        stale
          ? 'the first render after the window answered from the stale sha'
          : 'the first render after the window synced'
      )
      await shaRefreshed(ctx)
      await lab.visit({slot: 0})
      ctx.check(
        'the site shows the pushed title',
        renderedTitle('visitor', 'about') === 'About, from git'
      )
      await a.refresh(tab)
      ctx.check(
        'the dashboard does not have it yet',
        title(tab, 'about') === 'About'
      )
      ctx.step('⏩ 120 seconds later: the worker syncs on its interval')
      lab.advance(120)
      await ctx.waitFor(async () => {
        await a.refresh(tab)
        return title(tab, 'about') === 'About, from git'
      }, 'the interval sync brings the push')
      ctx.check(
        'the dashboard shows the pushed title',
        title(tab, 'about') === 'About, from git'
      )
    }
  },
  {
    id: 'concurrent',
    group: 'Edit',
    title: 'Two editors save at once',
    summary:
      'Both handlers plan on the same commit. Git accepts one; the other gets a conflict, syncs and plans again. Both editors end on the same content.',
    async run(ctx) {
      await lab.reset()
      const a1 = await openTab(ctx, a)
      const b1 = await openTab(ctx, b)
      deployments.routing = 'alternate'
      const before = github.commits.length
      ctx.step('Ada edits Home, Grace edits Blog, at the same time')
      await Promise.all([
        a.save(a1, pageIds.home, 'Home by Ada'),
        b.save(b1, pageIds.blog, 'Blog by Grace')
      ])
      await settled(ctx, a, a1)
      await settled(ctx, b, b1)
      ctx.check('both commits landed', github.commits.length === before + 2)
      const conflicts = ctx.events(e => e.kind === 'conflict')
      ctx.info(`${conflicts.length} conflict(s) were retried by a handler`)
      ctx.check(
        'git has both titles',
        headTitle('home') === 'Home by Ada' &&
          headTitle('blog') === 'Blog by Grace'
      )
      await a.sync(a1)
      await b.sync(b1)
      ctx.check(
        'both browsers end at the head',
        a1.sha === head() && b1.sha === head(),
        `${short(a1.sha)} ${short(b1.sha)} vs ${short(head())}`
      )
      ctx.check(
        'both see both edits',
        title(a1, 'blog') === 'Blog by Grace' &&
          title(b1, 'home') === 'Home by Ada'
      )
    }
  },
  {
    id: 'same-entry',
    group: 'Edit',
    title: 'Two editors change the same entry',
    summary:
      'The last commit wins. Each browser shows its own edit until it syncs, then both show what git has.',
    async run(ctx) {
      await lab.reset()
      const a1 = await openTab(ctx, a)
      const b1 = await openTab(ctx, b)
      ctx.step('Ada and Grace both rename Home')
      await Promise.all([
        a.save(a1, pageIds.home, 'Home (Ada)'),
        b.save(b1, pageIds.home, 'Home (Grace)')
      ])
      await settled(ctx, a, a1)
      await settled(ctx, b, b1)
      const winner = headTitle('home')
      ctx.info(`git holds "${winner}"`)
      await a.sync(a1)
      await b.sync(b1)
      ctx.check(
        'both browsers show what git holds',
        title(a1, 'home') === winner && title(b1, 'home') === winner,
        `${title(a1, 'home')} / ${title(b1, 'home')}`
      )
      ctx.check('both are at the head', a1.sha === head() && b1.sha === head())
    }
  },
  {
    id: 'lost-commit-response',
    group: 'Failures',
    title: "Git's answer to a commit is lost",
    summary:
      'The commit lands, but the handler never hears back and answers the save with an error. The worker syncs, finds its own content at the remote and settles the save instead of committing twice.',
    async run(ctx) {
      await lab.reset()
      const tab = await openTab(ctx, a)
      const before = github.commits.length
      network.dropNextResponse(
        lab.mode === 'cloud' ? 'cloud' : 'github',
        lab.mode === 'cloud' ? '/write' : '/commit'
      )
      ctx.step('Ada saves; the response of the commit is lost on the way back')
      await a.save(tab, pageIds.home, 'Home, response lost').catch(() => {})
      const activity = await settled(ctx, a, tab)
      ctx.check(
        'exactly one commit landed',
        github.commits.length === before + 1,
        `${github.commits.length - before}`
      )
      ctx.check(
        'the save settled as succeeded',
        activity?.status === 'succeeded',
        activity?.status
      )
      ctx.check('the worker is at the head', tab.sha === head())
    }
  },
  {
    id: 'lost-save-response',
    group: 'Failures',
    title: "The handler's answer to a save is lost",
    summary:
      'The browser never hears back from the handler. Its recovery sync finds the content it would have committed and settles the save.',
    async run(ctx) {
      await lab.reset()
      const tab = await openTab(ctx, a)
      const before = github.commits.length
      deployments.routing = 0
      network.dropNextResponse('handler-1', 'mutate')
      ctx.step('Ada saves; the response of the handler is lost')
      await a.save(tab, pageIds.home, 'Home, answer lost').catch(() => {})
      const activity = await settled(ctx, a, tab)
      ctx.check(
        'exactly one commit landed',
        github.commits.length === before + 1
      )
      ctx.check(
        'the save settled as succeeded',
        activity?.status === 'succeeded',
        activity?.status
      )
      deployments.routing = 'alternate'
    }
  },
  {
    id: 'git-down',
    group: 'Failures',
    title: 'Git is down during a save',
    summary:
      'The save fails and blocks further saves until it is retried; the edit stays in the browser. Retrying once git is back commits it.',
    async run(ctx) {
      await lab.reset()
      const tab = await openTab(ctx, a)
      const remote = lab.mode === 'cloud' ? 'cloud' : 'github'
      network.setFault(remote, 'down')
      ctx.step('Ada saves while git is down')
      await a.save(tab, pageIds.home, 'Home, saved offline').catch(() => {})
      const activity = await settled(ctx, a, tab)
      ctx.check(
        'the save failed',
        activity?.status === 'failed',
        activity?.status
      )
      ctx.info(
        title(tab, 'home') === 'Home, saved offline'
          ? 'the tab keeps showing the edit'
          : 'the worker synced back to the remote content: the edit waits in the failed activity',
        `the tab shows "${title(tab, 'home')}"`
      )
      ctx.step('Git recovers, Ada retries')
      network.setFault(remote, undefined)
      await a.retry(tab)
      const retried = await settled(ctx, a, tab)
      ctx.check(
        'the retry succeeded',
        retried?.status === 'succeeded',
        retried?.status
      )
      ctx.check('git has the edit', headTitle('home') === 'Home, saved offline')
    }
  },
  {
    id: 'git-hangs',
    group: 'Failures',
    title: 'Git hangs',
    summary:
      'Reads wait for a sync at most syncWait (10s) and then answer with the content they have. Watch which reads honor that.',
    async run(ctx) {
      await lab.reset()
      await lab.visit({slot: 0})
      const tab = await openTab(ctx, a)
      const remote = lab.mode === 'cloud' ? 'cloud' : 'github'
      network.setFault(remote, 'hang')
      lab.advance(61)
      ctx.step('A visitor arrives after the sha window: the handler sync hangs')
      const visit = lab.visit({slot: 0})
      await sleep(1500)
      ctx.step('⏩ 11 seconds')
      lab.advance(11)
      const page = await visit
      ctx.check(
        'the visitor got the current content after syncWait',
        page.pages.length === 3 && !page.error,
        page.error
      )
      ctx.step('The dashboard syncs: the handler asks git for the tree')
      ctx.mark()
      let done = false
      const sync = a.sync(tab).then(
        () => (done = true),
        () => (done = true)
      )
      await sleep(1500)
      lab.advance(11)
      await sleep(1500)
      if (done) ctx.check('the tree read answered within syncWait', true)
      else
        ctx.finding(
          'the tree read still waits after syncWait',
          lab.mode === 'cloud'
            ? 'Handler awaits cnx.getTreeIfDifferent outside syncForRead; CloudRemote aborts it after 30s'
            : 'Handler awaits cnx.getTreeIfDifferent outside syncForRead, and GithubSource has no timeout: the dashboard waits for its 60s read timeout'
        )
      ctx.step('⏩ 60 seconds: the client gives up on its read')
      lab.advance(60)
      await sync
      network.setFault(remote, undefined)
      await a.refresh(tab)
      ctx.check(
        'the dashboard still shows its content',
        tab.entries.length === 3
      )
    }
  },
  {
    id: 'preview',
    group: 'Edit',
    title: 'Preview an unsaved edit',
    summary:
      'The dashboard sends a patch against the content it shows. The render applies it on a fork of the cms database, which is thrown away: nothing is committed.',
    async run(ctx) {
      await lab.reset()
      const tab = await openTab(ctx, a)
      const shaBefore = head()
      ctx.step('Ada types a new title; the preview renders it')
      const page = await lab.preview(a, tab, pageIds.home, 'Home, being typed')
      ctx.check(
        'the preview shows the typed title',
        renderedTitle('preview', 'home') === 'Home, being typed'
      )
      ctx.check(
        'the render forked the database',
        ctx.events(e => e.kind === 'overlay' || e.kind === 'preview').length > 0
      )
      ctx.check('nothing was committed', head() === shaBefore)
      ctx.step('A visitor renders on the same pages instance')
      await lab.visit({slot: page.slot})
      ctx.check(
        'visitors see the published title',
        renderedTitle('visitor', 'home') === 'Home'
      )
    }
  },
  {
    id: 'config-deploy',
    group: 'Deploy',
    title: 'Deploy a config change',
    summary:
      'A new config changes the fingerprint: handler and pages restart on the new generated database, and the next dashboard tab gets a new shared worker that derives its entries again from the stored base instead of downloading everything.',
    async run(ctx) {
      await lab.reset()
      await openTab(ctx, a)
      await ctx.waitFor(async () => {
        await a.inspectStorage()
        return (bus.states[a.node]?.bases?.length ?? 0) > 0
      }, 'a base is stored')
      ctx.step('The developer pushes config v2 and it deploys')
      await lab.pushConfig(2)
      await lab.deploy()
      a.quit()
      ctx.mark()
      ctx.step('Ada opens the dashboard of the new build')
      const tab = await openTab(ctx, a)
      ctx.check('it runs the dashboard of config v2', tab.configVersion === 2)
      ctx.check(
        'the worker derived the entries again from the stored base',
        ctx.events(e => e.kind === 'reindex').length > 0
      )
      ctx.check(
        'it downloaded no blobs',
        ctx.requests(a.worker, 'blob').length === 0
      )
      ctx.check('the tab shows the content', tab.entries.length === 3)
      const config = labConfig(2)
      const rows = await tab.graph.find({
        type: config.schema.Page,
        select: {summary: config.schema.Page.summary!}
      })
      ctx.check('queries can select the new field', rows.length === 3)
      await lab.visit()
      ctx.check(
        'the site renders on the new deployment',
        (lab.rendered.visitor?.pages.length ?? 0) === 3
      )
    }
  },
  {
    id: 'content-deploy',
    group: 'Deploy',
    title: 'Deploy without a config change',
    summary:
      'The dashboard build is unchanged, so open tabs keep their shared worker and its store: only the handler and the pages restart.',
    async run(ctx) {
      await lab.reset()
      await openTab(ctx, a)
      await lab.developerPush('blog', 'Blog, deployed')
      await lab.deploy()
      ctx.mark()
      ctx.step('Ada opens another tab')
      const tab = await openTab(ctx, a)
      ctx.check(
        'no new shared worker started',
        ctx.events(e => e.node === a.worker && e.kind === 'worker').length === 0
      )
      await a.sync(tab)
      ctx.check('the tab is at the head', tab.sha === head())
      await lab.visit({slot: 0})
      ctx.check(
        'the cold pages instance serves the deployed content',
        renderedTitle('visitor', 'blog') === 'Blog, deployed'
      )
    }
  },
  {
    id: 'restart',
    group: 'Site',
    title: 'A pages instance restarts',
    summary:
      'A restarted pages instance opens the generated database of its build again, which may be far behind. With a fresh shared sha its first render syncs before answering.',
    async run(ctx) {
      await lab.reset()
      await lab.visit({slot: 0})
      await lab.developerPush('home', 'Home, after the build')
      lab.advance(61)
      await lab.visit({slot: 1})
      await shaRefreshed(ctx)
      await lab.visit({slot: 1})
      ctx.check(
        'pages λ2 serves the edit',
        renderedTitle('visitor', 'home') === 'Home, after the build'
      )
      ctx.step(
        "Pages λ1 stops and starts again: its database is the build's again"
      )
      deployments.stop('pages', 0)
      const page = await lab.visit({slot: 0})
      ctx.check(
        'the first render after the restart is at the head',
        page.sha === head(),
        `${short(page.sha)} vs ${short(head())}`
      )
      ctx.check(
        'it shows the edit made after the build',
        renderedTitle('visitor', 'home') === 'Home, after the build'
      )
    }
  },
  {
    id: 'cloud',
    group: 'Backends',
    title: 'The same save on Alinea Cloud',
    summary:
      'The handler commits through CloudRemote: the cloud API answers trees and blobs and commits to git for it.',
    async run(ctx) {
      await lab.reset({mode: 'cloud'})
      const tab = await openTab(ctx, a)
      ctx.check(
        'the dashboard loaded through the cloud',
        ctx.events(e => e.node === 'cloud').length > 0
      )
      ctx.step('Ada saves')
      await a.save(tab, pageIds.home, 'Home, via cloud')
      const activity = await settled(ctx, a, tab)
      ctx.check(
        'the save succeeded',
        activity?.status === 'succeeded',
        activity?.status
      )
      ctx.check(
        'git has the edit, committed by the cloud',
        headTitle('home') === 'Home, via cloud' &&
          github.head.author.includes('cloud')
      )
      lab.mode = 'self-hosted'
    }
  },
  {
    id: 'migrations',
    group: 'Backends',
    title: 'Every instance migrates the backend database',
    summary:
      'Each handler instance prepares its DatabaseApi once: rado compares every table with the schema and migrates what differs. On SQLite databases (libSQL, Turso) compare what the second instance does.',
    async run(ctx) {
      await lab.reset({driver: 'libsql'})
      ctx.step(
        'Ada opens the dashboard: both handler instances serve its first requests'
      )
      deployments.routing = 'alternate'
      await openTab(ctx, a)
      await lab.visit({slot: 0})
      await lab.visit({slot: 1})
      const rebuilt = ctx.events(
        e => e.kind === 'finding' && e.node === backendDb.node
      )
      if (rebuilt.length > 0)
        ctx.finding(
          `a new instance rebuilds ${rebuilt.length} table(s) (create new_, copy, drop, rename)`,
          "rado's SQLite diff formats columns from pragma_table_info, which reports no unique or references: alinea_user and alinea_user_role never match their schema"
        )
      else ctx.check('later instances find the tables as they are', true)
    }
  },
  {
    id: 'd1',
    group: 'Backends',
    title: 'Self-hosted on D1',
    summary:
      "backendFromOptions accepts driver 'd1'. DatabaseApi migrates its tables in a transaction, which rado's D1 driver does not support.",
    async run(ctx) {
      await lab.reset({driver: 'd1'})
      ctx.step('Ada opens the dashboard')
      const tab = await a.openTab()
      await ctx.waitFor(
        () => tab.ready || Boolean(tab.error),
        'the tab loads or fails'
      )
      if (tab.error?.includes('Transactions are not supported'))
        ctx.finding(
          'the first read fails: "Transactions are not supported in D1"',
          'DatabaseApi prepareDatabase → db.migrate → transaction; also createUser, updateUser and removeUser use db.transaction'
        )
      else ctx.check('the dashboard loaded', tab.ready, tab.error)
      backendDb.driver = 'libsql'
    }
  }
]

export const runs: Record<string, ScenarioRun | undefined> = {}

export async function runScenario(scenario: Scenario) {
  if (lab.busy) return
  lab.busy = true
  const run: ScenarioRun = {
    status: 'running',
    checks: [],
    startedAt: performance.now(),
    fromEvent: (bus.events[bus.events.length - 1]?.id ?? 0) + 1
  }
  runs[scenario.id] = run
  bus.scenario = scenario.id
  bus.changed()
  try {
    await scenario.run(new Context(run))
    run.status = 'done'
    run.step = undefined
  } catch (error) {
    run.status = 'error'
    run.error = error instanceof Error ? error.message : String(error)
    run.checks.push({label: `stopped: ${run.error}`, kind: 'fail'})
  } finally {
    lab.busy = false
    bus.scenario = undefined
    bus.changed()
  }
}
