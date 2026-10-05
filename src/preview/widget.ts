import type {DOMAttributes} from 'react'

export interface PreviewStat {
  kind: 'query' | 'sync'
  summary: string
  /** Whether the query was answered by the bundled database or the handler. */
  source?: 'database' | 'handler'
  /**
   * Execution time for queries the bundled database answers, without the
   * wait behind the render's other queries; time from call to answer for
   * syncs and queries the handler answers.
   */
  durationMs: number
  /** SQL statements this row's work ran, such as a preview's sync. */
  statements?: number
  sqlMs?: number
}

/** One of the slowest SQL statements of a render. */
export interface PreviewStatement {
  /** The statement, shortened */
  sql: string
  durationMs: number
  /** Summary of the query or sync that ran it */
  query?: string
}

/** The bundled database that answered the render's queries. */
export interface PreviewDatabase {
  /** The native overlay, the native file, or the WASM copy */
  driver?: string
  /** Time this process took to open it */
  openMs: number
  /** Whether this render waited for it to open */
  cold: boolean
}

/** The CMS work of one render, shown in the widget. */
export interface PreviewStats {
  rows: Array<PreviewStat>
  /** SQL statements run in this process for the render. */
  statements: number
  sqlMs: number
  /** Time from the first query or sync of the render until the last settled. */
  renderMs: number
  slowest?: Array<PreviewStatement>
  database?: PreviewDatabase
}

export function registerPreviewWidget() {
  if (customElements.get('alinea-preview')) return
  const observedAttributes = ['editurl', 'livepreview', 'stats']
  const template = `
    <div class="previews">
      <div class="inner">
        <div class="connection" title="Previewing live" id="preview-disabled">
          <svg  class="icon" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M11 22v-8.275q-.45-.275-.725-.712T10 12q0-.825.588-1.412T12 10t1.413.588T14 12q0 .575-.275 1.025t-.725.7V22zm-5.9-2.75q-1.425-1.375-2.262-3.238T2 12q0-2.075.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12q0 2.15-.837 4.025T18.9 19.25l-1.4-1.4q1.15-1.1 1.825-2.613T20 12q0-3.35-2.325-5.675T12 4T6.325 6.325T4 12q0 1.725.675 3.225t1.85 2.6zm2.825-2.825q-.875-.825-1.4-1.963T6 12q0-2.5 1.75-4.25T12 6t4.25 1.75T18 12q0 1.325-.525 2.475t-1.4 1.95L14.65 15q.625-.575.988-1.35T16 12q0-1.65-1.175-2.825T12 8T9.175 9.175T8 12q0 .9.363 1.663T9.35 15z"/>
          </svg>
        </div>
        <span class="separator"></span>
        <a target="_top" class="button" title="Edit content" id="btn-edit">
          <svg class="icon" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M5 19h1.425L16.2 9.225L14.775 7.8L5 17.575zm-1 2q-.425 0-.712-.288T3 20v-2.425q0-.4.15-.763t.425-.637L16.2 3.575q.3-.275.663-.425t.762-.15t.775.15t.65.45L20.425 5q.3.275.437.65T21 6.4q0 .4-.138.763t-.437.662l-12.6 12.6q-.275.275-.638.425t-.762.15zM19 6.4L17.6 5zm-3.525 2.125l-.7-.725L16.2 9.225z"/>
          </svg>
        </a>
        <span class="separator stats"></span>
        <button type="button" class="button stats" title="Click to log the queries of this page to the browser console" id="btn-stats"></button>
      </div>
    </div>
  `
  // The widget renders on the site itself: it can't rely on the dashboard's
  // stylesheets or bundled fonts, so it carries its own tokens and font stack.
  const styles = `
    :host {
      display: contents;
    }
    .previews {
      --alinea-accent: #3f61e8;
      --alinea-on-accent: #ffffff;
      --alinea-bg: #ffffff;
      --alinea-soft: #f4f4f1;
      --alinea-line: #e8e8e4;
      --alinea-fg: #1b1c24;
      --alinea-fg2: #5c5e6a;
      --alinea-bad: #b80d5a;
      --alinea-float: 0 0 0 1px rgb(27 28 36 / 8%),
        0 8px 24px -6px rgb(27 28 36 / 16%);
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
    }
    @media (prefers-color-scheme: dark) {
      .previews {
        --alinea-accent: #8ea2ff;
        --alinea-on-accent: #121318;
        --alinea-bg: #1b1c24;
        --alinea-soft: #262833;
        --alinea-line: #2c2e38;
        --alinea-fg: #ecedf1;
        --alinea-fg2: #a9acb8;
        --alinea-bad: #ff7fb2;
        --alinea-float: 0 0 0 1px #3a3c48, 0 8px 24px -6px rgb(0 0 0 / 50%);
      }
    }
    .inner {
      display: flex;
      align-items: center;
      gap: 2px;
      box-sizing: border-box;
      height: 48px;
      padding: 4px;
      background: var(--alinea-bg);
      border-radius: 14px;
      box-shadow: var(--alinea-float);
      color: var(--alinea-fg);
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1;
      white-space: nowrap;
      animation: fade-in 0.3s ease-out;
    }
    .inner[data-dragging="true"] {
      cursor: grabbing;
    }
    .inner[data-dragging="true"] * {
      pointer-events: none;
    }
    .icon {
      display: block;
      flex-shrink: 0;
      font-size: 18px;
    }
    .button {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--alinea-fg2);
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }
    .button:hover {
      background: var(--alinea-soft);
      color: var(--alinea-fg);
    }
    .button:focus-visible {
      outline: 2px solid var(--alinea-accent);
      outline-offset: -2px;
    }
    .connection {
      display: none;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      height: 40px;
      padding: 0 8px 0 4px;
    }
    .connection .icon {
      font-size: 16px;
    }
    .is-connected .connection {
      display: flex;
      color: var(--alinea-accent);
    }
    .is-warning .connection {
      display: flex;
      color: var(--alinea-bad);
    }
    .is-loading .connection {
      display: flex;
      color: var(--alinea-accent);
      animation: pulse 1s linear infinite;
    }
    /* Without the live indicator there is nothing to separate */
    .previews:not(.is-connected, .is-warning, .is-loading)
      .connection
      + .separator {
      display: none;
    }
    .separator {
      display: block;
      flex-shrink: 0;
      width: 1px;
      height: 20px;
      margin: 0 4px;
      background: var(--alinea-line);
    }
    .stats {
      display: none;
    }
    .has-stats .stats {
      display: flex;
    }
    .button.stats {
      width: auto;
      padding: 0 12px;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
      }
    }
  `

  class AlineaPreview extends HTMLElement {
    static observedAttributes = observedAttributes
    #previews?: HTMLDivElement
    #editButton?: HTMLAnchorElement
    #statsButton?: HTMLButtonElement
    #stats?: PreviewStats
    #hint?: ReturnType<typeof setTimeout>
    #disconnect!: () => void

    disconnectedCallback() {
      this.#disconnect()
    }

    attributeChangedCallback(
      name: string,
      _oldValue: string | null,
      value: string | null
    ) {
      switch (name) {
        case 'editurl':
          if (this.#editButton) this.#editButton.href = value ?? ''
          return
        case 'livepreview':
          this.#previews?.classList.toggle('is-loading', value === 'loading')
          this.#previews?.classList.toggle(
            'is-connected',
            value === 'connected'
          )
          this.#previews?.classList.toggle('is-warning', value === 'warning')
          return
        case 'stats':
          this.#stats = value ? JSON.parse(value) : undefined
          this.#previews?.classList.toggle('has-stats', Boolean(this.#stats))
          if (this.#statsButton) this.#statsButton.textContent = this.#summary()
          return
      }
    }

    #summary() {
      if (!this.#stats) return ''
      const {rows, statements, sqlMs, renderMs} = this.#stats
      const {queries, syncs} = split(rows)
      let text = `${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`
      // Queries the handler answers run no SQL here: show their wall time.
      text += statements
        ? ` · SQL ${Math.round(sqlMs)} ms`
        : ` · ${Math.round(renderMs)} ms`
      if (syncs.length) text += ` · sync ${total(syncs)} ms`
      return text
    }

    #logStats = () => {
      if (!this.#stats) return
      const {rows, statements, sqlMs, renderMs, slowest, database} = this.#stats
      const table: Array<Record<string, unknown>> = rows.map(row => ({
        type: row.kind,
        what: row.summary,
        source: row.source ?? '',
        ms: round(row.durationMs),
        statements: row.statements ?? '',
        sqlMs: row.sqlMs === undefined ? '' : round(row.sqlMs)
      }))
      if (database)
        table.push({
          type: 'database',
          what: `${database.driver ?? 'unknown driver'}, ${database.cold ? 'opened during this render' : 'already open'}`,
          source: 'database',
          ms: round(database.openMs)
        })
      for (const statement of slowest ?? [])
        table.push({
          type: 'slow sql',
          what: statement.sql,
          source: statement.query ?? '',
          ms: round(statement.durationMs)
        })
      if (statements)
        table.push({
          type: 'sql',
          what: `${statements} statements`,
          source: 'database',
          ms: round(sqlMs),
          statements,
          sqlMs: round(sqlMs)
        })
      table.push({
        type: 'render',
        what: 'wall time',
        source: '',
        ms: round(renderMs)
      })
      console.table(table)
      // Point at the console: the table is logged there, not shown here.
      const button = this.#statsButton
      if (!button) return
      button.textContent = 'Logged to console ↓'
      clearTimeout(this.#hint)
      this.#hint = setTimeout(() => {
        button.textContent = this.#summary()
      }, 1500)
    }

    connectedCallback() {
      const shadow = this.attachShadow({mode: 'open'})
      const style = document.createElement('style')
      style.textContent = styles
      shadow.appendChild(style)
      const wrapper = document.createElement('div')
      wrapper.innerHTML = template
      shadow.appendChild(wrapper)
      const previews: HTMLDivElement = wrapper.querySelector('.previews')!
      this.#previews = previews
      const inner: HTMLDivElement = wrapper.querySelector('.inner')!
      this.#editButton = previews.querySelector('#btn-edit')!
      this.#statsButton = previews.querySelector('#btn-stats')!
      this.#statsButton.addEventListener('click', this.#logStats)

      for (const attr of AlineaPreview.observedAttributes)
        this.attributeChangedCallback(attr, null, this.getAttribute(attr))

      let xPosition = 0.5
      previews.addEventListener('mousedown', startDrag)
      function startDrag(event: MouseEvent) {
        event.preventDefault()
        let current = xPosition
        const startX = event.clientX
        const startOffset = xPosition
        const windowWidth = window.innerWidth
        const containerWidth = previews.clientWidth
        const minOffset = containerWidth / 2
        function move(event: MouseEvent) {
          inner.dataset.dragging = 'true'
          const deltaX = event.clientX - startX
          let newX = Math.max(
            0,
            Math.min(1, startOffset + deltaX / windowWidth)
          )
          const min = minOffset / windowWidth
          if (newX < min) newX = min
          const max = 1 - min
          if (newX > max) newX = max
          current = newX
          previews.style.left = `${newX * 100}%`
          xPosition = newX
        }
        function stop() {
          const isCentered = Math.abs(current - 0.5) < 0.05
          if (isCentered) {
            previews.style.left = '50%'
            xPosition = 0.5
          }
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', stop)
          inner.dataset.dragging = undefined
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', stop)
      }

      this.#disconnect = () => {
        previews.removeEventListener('mousedown', startDrag)
      }
    }
  }

  function split(rows: Array<PreviewStat>) {
    return {
      queries: rows.filter(row => row.kind === 'query'),
      syncs: rows.filter(row => row.kind === 'sync')
    }
  }
  function round(ms: number) {
    return Math.round(ms * 10) / 10
  }
  function total(rows: Array<PreviewStat>) {
    return Math.round(rows.reduce((sum, row) => sum + row.durationMs, 0))
  }

  customElements.define('alinea-preview', AlineaPreview)
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'alinea-preview': DOMAttributes<HTMLElement> & {
        adminUrl: string
        editUrl: string
        livePreview?: 'connected' | 'warning' | 'loading'
        /** JSON encoded PreviewStats */
        stats?: string
      }
    }
  }
}
