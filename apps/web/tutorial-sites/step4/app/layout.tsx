import {cms} from '@/cms'
import {SiteFooter, SiteHeader} from '@/entries/settings/SiteLayout'
import {SiteLayout} from '@/entries/settings/SiteLayout.schema'

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  const settings = await cms.get({
    root: cms.workspaces.main.settings,
    type: SiteLayout
  })

  return (
    <html lang="en">
      <body>
        <SiteHeader settings={settings} />
        {children}
        <SiteFooter settings={settings} />
        <cms.previews widget />
      </body>
    </html>
  )
}
