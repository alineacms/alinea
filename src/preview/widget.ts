import type {DOMAttributes} from 'react'

export interface PreviewStat {
  kind: 'query' | 'sync'
  summary: string
  /** Whether the query was answered by the bundled database or the handler. */
  source?: 'database' | 'handler'
  durationMs: number
}

/** The CMS work of one render, shown in the widget. */
export interface PreviewStats {
  rows: Array<PreviewStat>
  /** SQL statements run in this process for the render. */
  statements: number
  sqlMs: number
}

export function registerPreviewWidget() {
  if (customElements.get('alinea-preview')) return
  const observedAttributes = ['adminurl', 'editurl', 'livepreview', 'stats']
  const template = `
    <div class="previews">
      <div class="inner">
        <a target="_top" class="button" title="Admin panel" id="btn-admin">
          <svg class="logo" viewBox="0 0 36 36" preserveAspectRatio="none">
            <path fill="#5763E6" d="M20.8178 10.3977V11.733C19.8978 10.6534 18.5316 10 16.6636 10C13.0112 10 10 13.267 10 17.5C10 21.733 13.0112 25 16.6636 25C18.5316 25 19.8978 24.3466 20.8178 23.267V24.6023H25V10.3977H20.8178ZM17.5 20.9659C15.5762 20.9659 14.1822 19.6307 14.1822 17.5C14.1822 15.3693 15.5762 14.0341 17.5 14.0341C19.4238 14.0341 20.8178 15.3693 20.8178 17.5C20.8178 19.6307 19.4238 20.9659 17.5 20.9659Z" />
          </svg>
        </a>
        <div class="connection" title="Previewing live" id="preview-disabled">
          <svg  class="icon" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M11 22v-8.275q-.45-.275-.725-.712T10 12q0-.825.588-1.412T12 10t1.413.588T14 12q0 .575-.275 1.025t-.725.7V22zm-5.9-2.75q-1.425-1.375-2.262-3.238T2 12q0-2.075.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12q0 2.15-.837 4.025T18.9 19.25l-1.4-1.4q1.15-1.1 1.825-2.613T20 12q0-3.35-2.325-5.675T12 4T6.325 6.325T4 12q0 1.725.675 3.225t1.85 2.6zm2.825-2.825q-.875-.825-1.4-1.963T6 12q0-2.5 1.75-4.25T12 6t4.25 1.75T18 12q0 1.325-.525 2.475t-1.4 1.95L14.65 15q.625-.575.988-1.35T16 12q0-1.65-1.175-2.825T12 8T9.175 9.175T8 12q0 .9.363 1.663T9.35 15z"/>
          </svg>
        </div>
        <span class="separator"></span>
        <a target="_top" class="button" title="Edit content" id="btn-edit">
          <svg class="icon" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="#5763E6" d="M3 17.46v3.04c0 .28.22.5.5.5h3.04c.13 0 .26-.05.35-.15L17.81 9.94l-3.75-3.75L3.15 17.1c-.1.1-.15.22-.15.36M20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z"/>
          </svg>
        </a>
        <span class="separator stats"></span>
        <button type="button" class="button stats" title="Click to log the queries of this page to the browser console" id="btn-stats"></button>
      </div>
    </div>
  `
  const styles = `
    :host {
      display: contents;
    }
    .previews {
      position: fixed;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
    }
    .inner {
      display: flex;
      align-items: center;
      background: #fff;
      border-radius: 17.5px;
      box-shadow: 0 0 1.4px rgba(0,0,0,.1), 0 2px 3.5px rgba(0,0,0,.1);
      z-index: 1000;
      height: 35px;
      font-size: 14px;
      font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      border: 1.5px solid #E4E4E7;
      transition: border 0.2s ease-out;
      animation: fade-in 0.3s ease-out;
    }
    .inner.is-centered {
      border-color: #8189e5;
    }
    .inner[data-dragging="true"] {
      cursor: grabbing;
    }
    .inner[data-dragging="true"] * {
      pointer-events: none;
    }
    .logo {
      display: block;
      height: 25px;
      width: auto;
      flex-shrink: 0;
    }
    .icon {
      display: block;
      font-size: 16px;
    }
    .button {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      color: #596e8d;
      white-space: nowrap;
      height: 100%;
      width: 45px;
    }
    .button:hover {
      color: #000;
    }
    .connection {
      display: none;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      margin-left: -6px;
      margin-top: -1px;
      padding-right: 13px;
      height: 100%;
    }
    .is-connected .connection {
      display: flex;
      color: #5763E6;
    }
    .is-warning .connection {
      display: flex;
      color: #bf1029;
    }
    .is-loading .connection {
      display: flex;
      color: #5763E6;
      animation: pulse 1s linear infinite;
    }
    .separator {
      display: block;
      border-left: 1px solid #E4E4E7;
      height: 16px;
    }
    .stats {
      display: none;
    }
    .has-stats .stats {
      display: flex;
    }
    .button.stats {
      width: auto;
      padding: 0 16px 0 12px;
      font: inherit;
      font-size: 13px;
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
    #adminButton?: HTMLAnchorElement
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
        case 'adminurl':
          if (this.#adminButton) this.#adminButton.href = value ?? ''
          return
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
      const {queries, syncs} = split(this.#stats.rows)
      let text = `${queries.length} ${queries.length === 1 ? 'query' : 'queries'} · ${total(queries)} ms`
      if (syncs.length) text += ` · sync ${total(syncs)} ms`
      return text
    }

    #logStats = () => {
      if (!this.#stats) return
      const {rows, statements, sqlMs} = this.#stats
      const table: Array<Record<string, unknown>> = rows.map(row => ({
        type: row.kind,
        what: row.summary,
        source: row.source ?? '',
        ms: round(row.durationMs)
      }))
      if (statements)
        table.push({
          type: 'sql',
          what: `${statements} statements`,
          source: 'database',
          ms: round(sqlMs)
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
      this.#adminButton = previews.querySelector('#btn-admin')!
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
