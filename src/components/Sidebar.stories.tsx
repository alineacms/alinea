import {useState} from 'react'
import {
  IcRoundAdd,
  IcRoundSearch,
  LucideFile,
  LucideFolder
} from '../dashboard/icons.js'
import {Button} from './Button.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from './DropdownMenu.js'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader
} from './Sidebar.js'
import {Text} from './Text.js'
import {Tree, TreeItem} from './Tree.js'

export function Example() {
  const [locale, setLocale] = useState('en')
  return (
    <div
      style={{
        display: 'flex',
        width: 300,
        height: 520,
        margin: 24,
        border: '1px solid var(--alinea-border)',
        borderRadius: 8,
        overflow: 'hidden'
      }}
    >
      <Sidebar aria-label="Content">
        <SidebarHeader>
          <Text weight="semibold">Main site</Text>
          <Button
            variant="ghost"
            size="icon-sm"
            icon={IcRoundSearch}
            aria-label="Search"
          />
        </SidebarHeader>
        <SidebarContent scroll>
          <SidebarGroup aria-labelledby="pages-label">
            <SidebarGroupLabel id="pages-label">Pages</SidebarGroupLabel>
            <SidebarGroupAction>
              <DropdownMenu>
                <DropdownMenuTrigger variant="ghost" size="sm">
                  {locale.toUpperCase()}
                </DropdownMenuTrigger>
                <DropdownMenuContent aria-label="Language" align="end">
                  <DropdownMenuRadioGroup
                    aria-label="Language"
                    value={locale}
                    onValueChange={setLocale}
                  >
                    <DropdownMenuRadioItem value="en">
                      English
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="nl">
                      Nederlands
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarGroupAction>
            <Tree aria-label="Pages" defaultExpandedKeys={['blog']}>
              <TreeItem id="home" title="Home" icon={LucideFile} />
              <TreeItem id="blog" title="Blog" icon={LucideFolder}>
                <TreeItem id="launch" title="Launch" icon={LucideFile} />
                <TreeItem id="roadmap" title="Roadmap" icon={LucideFile} />
              </TreeItem>
              <TreeItem id="about" title="About" icon={LucideFile} />
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
    </div>
  )
}

export default {
  title: 'Pure components / Sidebar'
}
