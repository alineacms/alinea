import {useState} from 'react'
import {
  IcBaselineAccountCircle,
  IcRoundAdd,
  LucideFile,
  LucideFolder,
  LucideImage,
  MaterialSymbolsRightPanelCloseRounded,
  MaterialSymbolsRightPanelOpenRounded
} from '../dashboard/icons.js'
import {AppShell, AppShellContent} from './AppShell.js'
import {Button} from './Button.js'
import {NavRail, NavRailContent, NavRailFooter, NavRailItem} from './NavRail.js'
import {Page, PageActions, PageContent, PageHeader, PageTitle} from './Page.js'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from './Resizable.js'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset
} from './Sidebar.js'
import {Surface} from './Surface.js'
import {Text} from './Text.js'
import {TextField} from './TextField.js'
import {Tree, TreeItem} from './Tree.js'

const roots = [
  {id: 'pages', label: 'Pages', icon: LucideFile},
  {id: 'media', label: 'Media', icon: LucideImage}
]

export function Example() {
  const [root, setRoot] = useState('pages')
  const [details, setDetails] = useState(true)
  const [width, setWidth] = useState(280)
  const label = roots.find(item => item.id === root)!.label
  return (
    <div style={{height: '100vh'}}>
      <AppShell>
        <NavRail aria-label="Roots">
          <NavRailContent>
            {roots.map(item => (
              <NavRailItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={root === item.id}
                onClick={() => setRoot(item.id)}
              />
            ))}
          </NavRailContent>
          <NavRailFooter>
            <NavRailItem icon={IcBaselineAccountCircle} label="Profile" />
          </NavRailFooter>
        </NavRail>
        <AppShellContent>
          <ResizablePanelGroup data-testid="layout">
            <ResizablePanel
              data-testid="navigation"
              size={width}
              onSizeChange={setWidth}
              defaultSize={280}
              minSize={200}
              maxSize={400}
              priority="low"
            >
              <Sidebar aria-label="Navigation">
                <SidebarHeader>
                  <Text weight="semibold">Main site</Text>
                </SidebarHeader>
                <SidebarContent scroll>
                  <SidebarGroup aria-labelledby="root-label">
                    <SidebarGroupLabel id="root-label">
                      {label}
                    </SidebarGroupLabel>
                    <Tree aria-label={label} defaultExpandedKeys={['blog']}>
                      <TreeItem id="home" title="Home" icon={LucideFile} />
                      <TreeItem id="blog" title="Blog" icon={LucideFolder}>
                        <TreeItem
                          id="launch"
                          title="Launch"
                          icon={LucideFile}
                        />
                      </TreeItem>
                    </Tree>
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                  <Button
                    color="secondary"
                    icon={IcRoundAdd}
                    style={{justifyContent: 'center'}}
                  >
                    Create new
                  </Button>
                </SidebarFooter>
              </Sidebar>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={320} priority="high">
              <SidebarInset>
                <ResizablePanelGroup>
                  <ResizablePanel key="page" minSize={240} priority="high">
                    <Page>
                      <PageHeader>
                        <PageTitle>Launch</PageTitle>
                        <PageActions>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              details ? 'Close details' : 'Open details'
                            }
                            icon={
                              details
                                ? MaterialSymbolsRightPanelCloseRounded
                                : MaterialSymbolsRightPanelOpenRounded
                            }
                            onClick={() => setDetails(!details)}
                          />
                        </PageActions>
                      </PageHeader>
                      <PageContent contained style={{padding: 16}}>
                        <Surface
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            padding: 16
                          }}
                        >
                          <TextField label="Title" defaultValue="Launch" />
                          <TextField label="Path" defaultValue="launch" />
                        </Surface>
                      </PageContent>
                    </Page>
                  </ResizablePanel>
                  {details && <ResizableHandle key="handle" />}
                  {details && (
                    <ResizablePanel
                      key="details"
                      data-testid="details"
                      defaultSize={300}
                      minSize={240}
                      priority="low"
                    >
                      <Sidebar side="right" aria-label="Details">
                        <SidebarHeader>
                          <Text weight="semibold">Details</Text>
                        </SidebarHeader>
                        <SidebarContent scroll>
                          <SidebarGroup>
                            <Text size="sm" color="muted">
                              Published on 22 September 2026
                            </Text>
                          </SidebarGroup>
                        </SidebarContent>
                      </Sidebar>
                    </ResizablePanel>
                  )}
                </ResizablePanelGroup>
              </SidebarInset>
            </ResizablePanel>
          </ResizablePanelGroup>
        </AppShellContent>
      </AppShell>
    </div>
  )
}

export default {
  title: 'Pure components / AppShell'
}
