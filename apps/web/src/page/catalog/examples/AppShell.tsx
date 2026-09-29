'use client'

import {
  AppShell,
  AppShellContent,
  NavRail,
  NavRailContent,
  NavRailItem,
  Page,
  PageHeader,
  PageTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Sidebar,
  SidebarHeader,
  SidebarInset,
  Text
} from 'alinea/components'
import {LucideFile, LucideImage} from 'alinea/dashboard/icons'

export function AppShellExample() {
  return (
    <div style={{width: 640, height: 320}}>
      <AppShell>
        <NavRail aria-label="Roots">
          <NavRailContent>
            <NavRailItem icon={LucideFile} label="Pages" active />
            <NavRailItem icon={LucideImage} label="Media" />
          </NavRailContent>
        </NavRail>
        <AppShellContent>
          <ResizablePanelGroup>
            <ResizablePanel defaultSize={200} minSize={160} priority="low">
              <Sidebar aria-label="Pages">
                <SidebarHeader>
                  <Text weight="semibold">Oak &amp; Loom</Text>
                </SidebarHeader>
              </Sidebar>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={240} priority="high">
              <SidebarInset>
                <Page>
                  <PageHeader>
                    <PageTitle>Linen shirt</PageTitle>
                  </PageHeader>
                </Page>
              </SidebarInset>
            </ResizablePanel>
          </ResizablePanelGroup>
        </AppShellContent>
      </AppShell>
    </div>
  )
}
