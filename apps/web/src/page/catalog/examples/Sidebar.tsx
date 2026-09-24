'use client'

import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  Text,
  Tree,
  TreeItem
} from 'alinea/components'
import {IcRoundAdd, LucideFile, LucideFolder} from 'alinea/dashboard/icons'

export function SidebarExample() {
  return (
    <div style={{display: 'flex', width: 280, height: 320}}>
      <Sidebar aria-label="Content">
        <SidebarHeader>
          <Text weight="semibold">Oak &amp; Loom</Text>
        </SidebarHeader>
        <SidebarContent scroll>
          <SidebarGroup aria-labelledby="pages-label">
            <SidebarGroupLabel id="pages-label">Pages</SidebarGroupLabel>
            <Tree aria-label="Pages" defaultExpandedKeys={['products']}>
              <TreeItem id="home" title="Home" icon={LucideFile} />
              <TreeItem id="products" title="Products" icon={LucideFolder}>
                <TreeItem id="shirt" title="Linen shirt" icon={LucideFile} />
              </TreeItem>
            </Tree>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Button color="secondary" icon={IcRoundAdd}>
            Create new
          </Button>
        </SidebarFooter>
      </Sidebar>
    </div>
  )
}
