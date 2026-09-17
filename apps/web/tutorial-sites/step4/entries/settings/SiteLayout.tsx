import type {Infer} from 'alinea'
import type {SiteLayout as SiteLayoutEntry} from './SiteLayout.schema'

type SiteLayoutProps = Infer.Entry<typeof SiteLayoutEntry>

export function SiteHeader({settings}: {settings: SiteLayoutProps}) {
  return <header>{settings.headerText}</header>
}

export function SiteFooter({settings}: {settings: SiteLayoutProps}) {
  return <footer>{settings.footerText}</footer>
}
