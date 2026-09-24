/** The part of Astro's integration API Alinea uses. */
export interface AstroIntegration {
  name: string
  hooks: {
    'astro:config:setup'(options: {
      injectScript(stage: 'page', content: string): void
    }): void
    'astro:server:start'(options: {
      address: {port: number}
      logger: {info(message: string): void; warn(message: string): void}
    }): void
  }
}

/**
 * Live previews reload the page after each edit. Pages using Astro's
 * `<ClientRouter />` swap in the refreshed page instead, keeping the scroll
 * position and skipping the transition animation. The previews client runs
 * once per browser session there, so its widget is carried over to every
 * page the router swaps in, with the edit link and stats of that page.
 */
export const previewsScript = `
document.addEventListener('astro:before-swap', ({newDocument, to}) => {
  const widget = document.querySelector('alinea-preview')
  const script = newDocument.querySelector('script[data-widget][src$="/previews.js"]')
  if (!widget || !script) return
  const {stats} = script.dataset
  if (stats) widget.setAttribute('stats', stats)
  const editUrl = widget.getAttribute('editurl') ?? ''
  const url = encodeURIComponent(to.pathname)
  widget.setAttribute('editurl', editUrl.replace(/([?&]url=)[^&]*/, '$1' + url))
  newDocument.body.append(widget)
})
addEventListener('alinea:refresh', event => {
  if (!document.querySelector('meta[name="astro-view-transitions-enabled"]')) return
  event.preventDefault()
  const x = scrollX, y = scrollY
  const skip = ({viewTransition}) => {
    viewTransition.ready.catch(() => {})
    viewTransition.skipTransition()
  }
  const restore = () => scrollTo(x, y)
  document.addEventListener('astro:before-swap', skip, {once: true})
  document.addEventListener('astro:after-swap', restore, {once: true})
  import('astro:transitions/client')
    .then(({navigate}) => navigate(location.href, {history: 'replace'}))
    .finally(() => {
      document.removeEventListener('astro:before-swap', skip)
      document.removeEventListener('astro:after-swap', restore)
      event.detail.done()
    })
})
`

/**
 * Refreshes live previews without reloading on pages using `<ClientRouter />`,
 * keeps the preview widget across its navigations and prints the dashboard
 * location in development. Add it to `integrations` in `astro.config.mjs`.
 */
export function alinea(): AstroIntegration {
  return {
    name: 'alinea',
    hooks: {
      'astro:config:setup'({injectScript}) {
        injectScript('page', previewsScript)
      },
      'astro:server:start'({address, logger}) {
        const adminPath = process.env.ALINEA_ADMIN_PATH
        if (process.env.ALINEA_DEV_SERVER && adminPath)
          logger.info(`Dashboard: http://localhost:${address.port}${adminPath}`)
        else logger.warn('Run `alinea dev -- astro dev` to edit content')
      }
    }
  }
}
