import styler from '@alinea/styler'
import {
  IcOutlineSettings,
  IcRoundAdd,
  IcRoundArchive,
  IcRoundLanguage,
  IcRoundMoreVert,
  IcRoundPublic,
  LucideFile,
  LucideFolder
} from '#/dashboard/icons.js'
import {AppShell, AppShellContent, AppShellInner} from './AppShell.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {Checkbox} from './Checkbox.js'
import {
  DataTable,
  DataTableCell,
  DataTableCellMeta,
  DataTableCellStack,
  DataTableCellTitle,
  DataTableHeader,
  DataTableRow
} from './DataTable.js'
import {
  Navigation,
  NavigationHeading,
  NavigationItem,
  NavigationSection
} from './Navigation.js'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderMain,
  PageHeaderSearch,
  PageHeaderTitle,
  PageHeaderTools
} from './PageHeader.js'
import {Rail, RailBody, RailFooter, RailHeader} from './Rail.js'
import {SearchField} from './SearchField.js'
import css from './OverviewPage.module.css'

const styles = styler(css)

const entries = [
  {
    title: 'Home',
    path: '/',
    type: 'Page',
    status: 'published' as const,
    updated: 'Today, 09:42'
  },
  {
    title: 'About us',
    path: '/about',
    type: 'Page',
    status: 'draft' as const,
    updated: 'Yesterday'
  },
  {
    title: 'News',
    path: '/news',
    type: 'Folder',
    status: 'published' as const,
    updated: 'Aug 18'
  },
  {
    title: 'Summer release',
    path: '/news/summer-release',
    type: 'Article',
    status: 'unpublished' as const,
    updated: 'Aug 16'
  },
  {
    title: 'Contact',
    path: '/contact',
    type: 'Page',
    status: 'published' as const,
    updated: 'Aug 11'
  },
  {
    title: 'Old campaign',
    path: '/campaign-2024',
    type: 'Page',
    status: 'archived' as const,
    updated: 'Jul 29'
  }
]

export function OverviewPage() {
  return (
    <AppShell>
      <AppShellInner>
        <AppShellContent>
          <Rail width={260}>
            <RailHeader>
              <div className={styles['alinea-OverviewPage-sidebarHeader']()}>
                <span className={styles['alinea-OverviewPage-sidebarTitle']()}>
                  Editorial
                </span>
                <Button
                  appearance="plain"
                  aria-label="Workspace settings"
                  size="icon-small"
                >
                  <IcOutlineSettings />
                </Button>
              </div>
            </RailHeader>
            <RailBody>
              <Navigation label="Content">
                <NavigationSection>
                  <NavigationHeading>Content</NavigationHeading>
                  <NavigationItem
                    icon={<IcRoundPublic />}
                    label="Pages"
                    selected
                  />
                  <NavigationItem
                    depth={1}
                    icon={<LucideFile />}
                    label="Home"
                  />
                  <NavigationItem
                    depth={1}
                    icon={<LucideFile />}
                    label="About us"
                  />
                  <NavigationItem
                    depth={1}
                    icon={<LucideFolder />}
                    label="News"
                    meta="3"
                  />
                </NavigationSection>
                <NavigationSection>
                  <NavigationHeading>Workspace</NavigationHeading>
                  <NavigationItem icon={<IcRoundLanguage />} label="Locales" />
                  <NavigationItem icon={<IcRoundArchive />} label="Archive" />
                </NavigationSection>
              </Navigation>
            </RailBody>
            <RailFooter>
              <div className={styles['alinea-OverviewPage-sidebarFooter']()}>
                <span>English</span>
                <Badge size="small" status="published">
                  Live
                </Badge>
              </div>
            </RailFooter>
          </Rail>
          <Rail main>
            <PageHeader>
              <PageHeaderMain>
                <PageHeaderTitle>Pages</PageHeaderTitle>
              </PageHeaderMain>
              <PageHeaderTools>
                <PageHeaderSearch>
                  <SearchField
                    aria-label="Search pages"
                    placeholder="Search pages"
                  />
                </PageHeaderSearch>
                <PageHeaderActions>
                  <Button intent="primary" icon={<IcRoundAdd />}>
                    New entry
                  </Button>
                </PageHeaderActions>
              </PageHeaderTools>
            </PageHeader>
            <RailBody>
              <div className={styles['alinea-OverviewPage-content']()}>
                <DataTable
                  columns="44px minmax(240px, 2fr) 120px 120px 120px 44px"
                  label="Pages"
                >
                  <DataTableHeader>
                    <DataTableCell align="center" header>
                      <Checkbox aria-label="Select all pages" label="" />
                    </DataTableCell>
                    <DataTableCell header>Name</DataTableCell>
                    <DataTableCell header>Type</DataTableCell>
                    <DataTableCell header>Status</DataTableCell>
                    <DataTableCell header>Updated</DataTableCell>
                    <DataTableCell header />
                  </DataTableHeader>
                  {entries.map((entry, index) => (
                    <DataTableRow
                      key={entry.path}
                      selected={index === 1}
                      tabIndex={0}
                    >
                      <DataTableCell align="center">
                        <Checkbox
                          aria-label={`Select ${entry.title}`}
                          label=""
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <span
                          className={styles['alinea-OverviewPage-fileIcon']()}
                        >
                          {entry.type === 'Folder' ? (
                            <LucideFolder />
                          ) : (
                            <LucideFile />
                          )}
                        </span>
                        <DataTableCellStack>
                          <DataTableCellTitle>{entry.title}</DataTableCellTitle>
                          <DataTableCellMeta>{entry.path}</DataTableCellMeta>
                        </DataTableCellStack>
                      </DataTableCell>
                      <DataTableCell>{entry.type}</DataTableCell>
                      <DataTableCell>
                        <Badge size="small" status={entry.status}>
                          {entry.status}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>
                        <span className={styles['alinea-OverviewPage-date']()}>
                          {entry.updated}
                        </span>
                      </DataTableCell>
                      <DataTableCell align="center">
                        <Button
                          appearance="plain"
                          aria-label={`Actions for ${entry.title}`}
                          size="icon-small"
                        >
                          <IcRoundMoreVert />
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTable>
              </div>
            </RailBody>
          </Rail>
        </AppShellContent>
      </AppShellInner>
    </AppShell>
  )
}
