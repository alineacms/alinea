import styler from '@alinea/styler'
import {useMemo, useState} from 'react'
import {
  IcBaselineContentCopy,
  IcOutlineDarkMode,
  IcOutlineLightMode,
  IcOutlineSettings,
  IcRoundArchive,
  IcRoundArrowBack,
  IcRoundArrowForward,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundDesktopWindows,
  IcRoundHistory,
  IcRoundLanguage,
  IcRoundLink,
  IcRoundMoreHoriz,
  IcRoundOpenInNew,
  IcRoundPanorama,
  IcRoundRefresh,
  IcRoundSearch,
  IcRoundUnfoldMore,
  IcOutlineGridView,
  IcOutlineTableRows,
  IcRoundAdd,
  IcRoundEdit,
  LucideFile,
  LucideFolder,
  LucideImage,
  MaterialSymbolsRightPanelCloseRounded,
  MaterialSymbolsRightPanelOpenRounded
} from '../dashboard/icons.js'
import {AppShell, AppShellContent} from './AppShell.js'
import {Badge} from './Badge.js'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './Breadcrumbs.js'
import {Button} from './Button.js'
import {Checkbox} from './Checkbox.js'
import {CheckboxGroup} from './CheckboxGroup.js'
import {Code} from './Code.js'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './Collapsible.js'
import {ColorSwatchPicker, ColorSwatchPickerItem} from './ColorSwatchPicker.js'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './Command.js'
import {ContentCard} from './ContentCard.js'
import {ContentGrid, ContentGridItem} from './ContentGrid.js'
import {
  Table,
  TableCell,
  TableRow,
  TableThumbnail,
  TableTitle
} from './Table.js'
import styles from './Dashboard.stories.module.css'
import {DatePicker} from './DatePicker.js'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './Dialog.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from './DropdownMenu.js'
import {Heading} from './Heading.js'
import {Kbd} from './Kbd.js'
import {
  List,
  ListCreateRow,
  ListDragPreview,
  ListItem,
  ListItemDescription,
  ListItemStatus,
  ListItemTitle,
  ListItemVisual,
  ListLabel,
  ListRow,
  ListRowBadges,
  ListRowBody,
  ListRowDrag,
  ListRowDragHandle,
  ListRowHeader,
  ListRowMeta
} from './List.js'
import {MultipleSelect, MultipleSelectItem} from './MultipleSelect.js'
import {
  NavRail,
  NavRailContent,
  NavRailFooter,
  NavRailHeader,
  NavRailItem
} from './NavRail.js'
import {NumberField} from './NumberField.js'
import {Page, PageActions, PageContent, PageHeader} from './Page.js'
import {Popover, PopoverContent, PopoverTrigger} from './Popover.js'
import {RadioGroup, RadioGroupItem} from './RadioGroup.js'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from './Resizable.js'
import {SearchField} from './SearchField.js'
import {Select, SelectItem} from './Select.js'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset
} from './Sidebar.js'
import {Spinner} from './Spinner.js'
import {Surface} from './Surface.js'
import {Switch} from './Switch.js'
import {Tabs, TabsContent, TabsList, TabsTrigger} from './Tabs.js'
import {Text} from './Text.js'
import {TextField} from './TextField.js'
import {Toggle} from './Toggle.js'
import {ToggleGroup, ToggleGroupItem} from './ToggleGroup.js'
import {Tree, TreeItem} from './Tree.js'
import type {DragMoveEvent, IconType, Key, Selection} from './types.js'

const cx = styler(styles)

interface StoryPage {
  id: string
  title: string
  path: string
  type: string
  status: 'published' | 'draft' | 'archived'
  updated: string
  author: string
  hue: number
}

const pages: Array<StoryPage> = [
  {
    id: 'launch',
    title: 'Launching the new platform',
    path: 'launching-the-new-platform',
    type: 'Article',
    status: 'draft',
    updated: '2026-09-22',
    author: 'Els',
    hue: 210
  },
  {
    id: 'roadmap',
    title: 'Our roadmap for 2027',
    path: 'roadmap-2027',
    type: 'Article',
    status: 'published',
    updated: '2026-09-18',
    author: 'Niels',
    hue: 280
  },
  {
    id: 'team',
    title: 'Meet the team',
    path: 'meet-the-team',
    type: 'Article',
    status: 'published',
    updated: '2026-08-30',
    author: 'Cat',
    hue: 30
  },
  {
    id: 'events',
    title: 'Autumn events',
    path: 'autumn-events',
    type: 'Article',
    status: 'archived',
    updated: '2026-07-12',
    author: 'Jade',
    hue: 140
  }
]

function thumbnail(hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 60%)"/><stop offset="1" stop-color="hsl(${hue + 50} 60% 30%)"/></linearGradient></defs><rect width="96" height="64" fill="url(#g)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

interface Section {
  id: string
  type: string
  icon: IconType
  label: string
}

function moveSections(sections: Array<Section>, {keys, target}: DragMoveEvent) {
  const moved = sections.filter(section => keys.has(section.id))
  const rest = sections.filter(section => !keys.has(section.id))
  const index = rest.findIndex(section => section.id === target.key)
  if (index === -1) return sections
  rest.splice(target.position === 'before' ? index : index + 1, 0, ...moved)
  return rest
}

function RootRail() {
  const [theme, setTheme] = useState('system')
  return (
    <NavRail aria-label="Roots">
      <NavRailHeader>
        <span className={cx.DashboardStory.logo()} aria-hidden>
          a
        </span>
      </NavRailHeader>
      <NavRailContent>
        <NavRailItem icon={LucideFile} label="Pages" active />
        <NavRailItem icon={LucideImage} label="Media" />
      </NavRailContent>
      <NavRailFooter>
        <Popover modal={false}>
          <PopoverTrigger
            variant="ghost"
            size="icon-lg"
            icon={IcRoundCheck}
            aria-label="Activity"
          />
          <PopoverContent side="right" align="end" aria-label="Activity">
            <List>
              <ListItem
                leading={
                  <ListItemVisual>
                    <Spinner size="sm" aria-label="Saving" />
                  </ListItemVisual>
                }
                trailing={<ListItemStatus tone="accent">Saving</ListItemStatus>}
              >
                <ListItemTitle>Launching the new platform</ListItemTitle>
                <ListItemDescription>Updated draft · 14:02</ListItemDescription>
              </ListItem>
            </List>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger
            variant="ghost"
            size="icon-lg"
            icon={IcOutlineSettings}
            aria-label="Profile"
          />
          <PopoverContent side="right" align="end" aria-label="Profile">
            <div className={cx.DashboardStory.profile()}>
              <Text weight="semibold">Ben Merckx</Text>
              <Text size="sm" color="muted">
                Appearance
              </Text>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={setTheme}
                aria-label="Appearance"
              >
                <ToggleGroupItem
                  value="system"
                  icon={IcRoundDesktopWindows}
                  aria-label="System"
                />
                <ToggleGroupItem
                  value="light"
                  icon={IcOutlineLightMode}
                  aria-label="Light"
                />
                <ToggleGroupItem
                  value="dark"
                  icon={IcOutlineDarkMode}
                  aria-label="Dark"
                />
              </ToggleGroup>
            </div>
          </PopoverContent>
        </Popover>
      </NavRailFooter>
    </NavRail>
  )
}

function SearchDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        variant="ghost"
        size="icon-sm"
        icon={IcRoundSearch}
        aria-label="Search"
      />
      <DialogContent aria-label="Search" showCloseButton={false}>
        <Command>
          <CommandInput placeholder="Search pages…" autoFocus />
          <CommandList>
            <CommandEmpty>No pages found</CommandEmpty>
            <CommandGroup heading="Pages">
              {pages.map(page => (
                <CommandItem
                  key={page.id}
                  value={page.id}
                  textValue={page.title}
                  icon={LucideFile}
                  onSelect={() => setOpen(false)}
                >
                  {page.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <Text size="xs" color="muted">
          Open search with <Kbd size="sm">⌘ K</Kbd>
        </Text>
      </DialogContent>
    </Dialog>
  )
}

function CreateDialog() {
  const [order, setOrder] = useState('last')
  return (
    <Dialog>
      <DialogTrigger
        variant="outline"
        icon={IcRoundAdd}
        className={cx.DashboardStory.create()}
      >
        Create new
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new page</DialogTitle>
          <DialogDescription>
            The page is saved as a draft until you publish it.
          </DialogDescription>
        </DialogHeader>
        <TextField label="Title" autoFocus />
        <Select label="Type" defaultValue="article">
          <SelectItem value="article" icon={LucideFile}>
            Article
          </SelectItem>
          <SelectItem value="folder" icon={LucideFolder}>
            Folder
          </SelectItem>
        </Select>
        <ToggleGroup
          type="single"
          value={order}
          onValueChange={setOrder}
          aria-label="Insert"
        >
          <ToggleGroupItem value="first">Insert first</ToggleGroupItem>
          <ToggleGroupItem value="last">Insert last</ToggleGroupItem>
        </ToggleGroup>
        <DialogFooter>
          <DialogClose variant="ghost">Cancel</DialogClose>
          <DialogClose color="primary">Create</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ContentSidebarProps {
  selected: Key
  onSelect: (key: Key) => void
}

function ContentSidebar({selected, onSelect}: ContentSidebarProps) {
  const [workspace, setWorkspace] = useState('main')
  const [locale, setLocale] = useState('en')
  return (
    <Sidebar aria-label="Content">
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger variant="ghost" icon={IcRoundUnfoldMore}>
            {workspace === 'main' ? 'Main site' : 'Intranet'}
          </DropdownMenuTrigger>
          <DropdownMenuContent aria-label="Workspaces" align="start">
            <DropdownMenuRadioGroup
              aria-label="Workspace"
              value={workspace}
              onValueChange={setWorkspace}
            >
              <DropdownMenuRadioItem value="main">
                Main site
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="intranet">
                Intranet
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={IcOutlineSettings}>
              Manage users
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SearchDialog />
      </SidebarHeader>
      <SidebarContent scroll>
        <SidebarGroup aria-labelledby="dashboard-root-label">
          <SidebarGroupLabel id="dashboard-root-label">Pages</SidebarGroupLabel>
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
                  <DropdownMenuRadioItem value="fr">
                    Français
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarGroupAction>
          <Tree
            aria-label="Pages"
            selectionMode="single"
            selectedKeys={new Set([selected])}
            onSelectionChange={keys => {
              if (keys === 'all') return
              const [key] = keys
              if (key !== undefined) onSelect(key)
            }}
            defaultExpandedKeys={['blog']}
          >
            <TreeItem id="home" title="Home" icon={LucideFile} />
            <TreeItem id="blog" title="Blog" icon={LucideFolder}>
              {pages.map(page => (
                <TreeItem
                  key={page.id}
                  id={page.id}
                  title={page.title}
                  icon={LucideFile}
                  suffix={
                    page.status !== 'published' && (
                      <Badge size="sm" status={page.status}>
                        {page.status}
                      </Badge>
                    )
                  }
                />
              ))}
            </TreeItem>
            <TreeItem id="about" title="About" icon={LucideFile} />
          </Tree>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <CreateDialog />
      </SidebarFooter>
    </Sidebar>
  )
}

interface HeaderProps {
  page: StoryPage
  view: string
  onViewChange: (view: string) => void
  asideOpen: boolean
  onAsideOpenChange: (open: boolean) => void
  dirty: boolean
}

function EditorHeader({
  page,
  view,
  onViewChange,
  asideOpen,
  onAsideOpenChange,
  dirty
}: HeaderProps) {
  return (
    <PageHeader
      className={cx.DashboardStory.header()}
      data-dirty={dirty || undefined}
    >
      <Button
        variant="ghost"
        size="icon"
        icon={IcRoundArrowBack}
        aria-label="Back"
      />
      <div className={cx.DashboardStory.header.title()}>
        <Breadcrumb>
          <BreadcrumbList className={cx.DashboardStory.header.breadcrumbs()}>
            <BreadcrumbItem>
              <BreadcrumbLink href="#pages">Pages</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#blog">Blog</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{page.path}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Heading as="h1" size="sm" truncate>
          {page.title}
        </Heading>
      </div>
      <Badge status={page.status}>{page.status}</Badge>
      <Badge icon={LucideFile}>{page.type}</Badge>
      <PageActions>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={value => value && onViewChange(value)}
          aria-label="View"
        >
          <ToggleGroupItem value="edit" icon={IcRoundEdit} aria-label="Edit" />
          <ToggleGroupItem
            value="overview"
            icon={IcOutlineTableRows}
            aria-label="Overview"
          />
        </ToggleGroup>
        <DropdownMenu>
          <DropdownMenuTrigger
            variant="ghost"
            size="icon"
            icon={IcRoundMoreHoriz}
            aria-label="More actions"
          />
          <DropdownMenuContent aria-label="Actions" align="end">
            <DropdownMenuGroup aria-label="Entry">
              <DropdownMenuLabel>Entry</DropdownMenuLabel>
              <DropdownMenuItem icon={IcBaselineContentCopy}>
                Duplicate
                <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem icon={IcRoundHistory}>
                Show history
              </DropdownMenuItem>
              <DropdownMenuItem icon={IcRoundArchive}>Archive</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={IcRoundDelete} variant="destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" disabled={!dirty}>
          Save draft
        </Button>
        <Button color="primary">Publish</Button>
        <Toggle
          pressed={asideOpen}
          onPressedChange={onAsideOpenChange}
          icon={
            asideOpen
              ? MaterialSymbolsRightPanelCloseRounded
              : MaterialSymbolsRightPanelOpenRounded
          }
          aria-label={asideOpen ? 'Close sidebar' : 'Open sidebar'}
        />
      </PageActions>
    </PageHeader>
  )
}

function EditorForm({page, onChange}: {page: StoryPage; onChange: () => void}) {
  const [sections, setSections] = useState<Array<Section>>([
    {id: 'hero', type: 'Hero', icon: IcRoundPanorama, label: 'Introduction'},
    {id: 'text', type: 'Text', icon: IcRoundEdit, label: 'Body copy'},
    {id: 'image', type: 'Image', icon: LucideImage, label: 'Header image'}
  ])
  return (
    <Tabs defaultValue="content">
      <TabsList aria-label="Entry tabs">
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="metadata">Metadata</TabsTrigger>
      </TabsList>
      <TabsContent value="content">
        <div className={cx.DashboardStory.form()}>
          <Surface>
            <div className={cx.DashboardStory.fields()}>
              <div className={cx.DashboardStory.fields.full()}>
                <TextField
                  label="Title"
                  defaultValue={page.title}
                  onValueChange={onChange}
                  required
                />
              </div>
              <TextField
                label="Path"
                description="Used in the url"
                defaultValue={page.path}
                onValueChange={onChange}
              />
              <DatePicker
                label="Publication date"
                defaultValue={page.updated}
                onValueChange={onChange}
              />
              <Select
                label="Author"
                defaultValue={page.author}
                onValueChange={onChange}
              >
                {['Els', 'Niels', 'Cat', 'Jade'].map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </Select>
              <MultipleSelect
                label="Tags"
                defaultValue={['product']}
                onValueChange={onChange}
              >
                <MultipleSelectItem value="product">Product</MultipleSelectItem>
                <MultipleSelectItem value="company">Company</MultipleSelectItem>
                <MultipleSelectItem value="events">Events</MultipleSelectItem>
              </MultipleSelect>
              <RadioGroup
                label="Layout"
                defaultValue="wide"
                orientation="horizontal"
                onValueChange={onChange}
              >
                <RadioGroupItem value="wide">Wide</RadioGroupItem>
                <RadioGroupItem value="narrow">Narrow</RadioGroupItem>
              </RadioGroup>
              <CheckboxGroup
                label="Channels"
                defaultValue={['web']}
                orientation="horizontal"
                onValueChange={onChange}
              >
                <Checkbox value="web">Website</Checkbox>
                <Checkbox value="app">App</Checkbox>
                <Checkbox value="newsletter">Newsletter</Checkbox>
              </CheckboxGroup>
              <div className={cx.DashboardStory.fields.full()}>
                <Switch defaultChecked onCheckedChange={onChange}>
                  Show in navigation
                </Switch>
              </div>
            </div>
          </Surface>
          <div>
            <ListLabel expanded hasRows>
              Sections
            </ListLabel>
            <List
              aria-label="Sections"
              onReorder={event => {
                setSections(current => moveSections(current, event))
                onChange()
              }}
            >
              {sections.map((section, index) => (
                <ListRow
                  key={section.id}
                  id={section.id}
                  first={index === 0}
                  aria-label={section.label}
                  role="listitem"
                  dragPreview={
                    <ListDragPreview icon={section.icon} label={section.type} />
                  }
                >
                  <ListRowHeader first={index === 0} hasFold={false}>
                    <ListRowDragHandle aria-label={`Drag ${section.label}`} />
                    <ListRowDrag>
                      <ListRowBadges>
                        <Badge icon={section.icon} size="sm">
                          {section.type}
                        </Badge>
                        <ListRowMeta>{section.label}</ListRowMeta>
                      </ListRowBadges>
                    </ListRowDrag>
                  </ListRowHeader>
                  {index === 0 && (
                    <ListRowBody>
                      <TextField
                        label="Heading"
                        defaultValue="A platform for every team"
                      />
                    </ListRowBody>
                  )}
                </ListRow>
              ))}
              <ListCreateRow>
                <Button variant="ghost" size="sm" icon={IcRoundAdd}>
                  Add section
                </Button>
              </ListCreateRow>
            </List>
          </div>
          <Surface>
            <Collapsible>
              <CollapsibleTrigger>Advanced</CollapsibleTrigger>
              <CollapsibleContent>
                <div className={cx.DashboardStory.fields()}>
                  <NumberField
                    label="Reading time"
                    defaultValue={4}
                    formatOptions={{style: 'unit', unit: 'minute'}}
                  />
                  <ColorSwatchPicker
                    aria-label="Accent color"
                    defaultValue="#3B82F6"
                  >
                    {['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'].map(color => (
                      <ColorSwatchPickerItem key={color} color={color} />
                    ))}
                  </ColorSwatchPicker>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Surface>
        </div>
      </TabsContent>
      <TabsContent value="metadata">
        <div className={cx.DashboardStory.form()}>
          <Surface>
            <div className={cx.DashboardStory.fields()}>
              <div className={cx.DashboardStory.fields.full()}>
                <TextField label="SEO title" defaultValue={page.title} />
              </div>
              <div className={cx.DashboardStory.fields.full()}>
                <TextField
                  label="Description"
                  multiline
                  rows={3}
                  defaultValue="The new platform is here."
                />
              </div>
            </div>
          </Surface>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function Overview({onOpen}: {onOpen: (key: Key) => void}) {
  const [layout, setLayout] = useState('table')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selection>(new Set())
  const items = useMemo(
    () =>
      pages.filter(page =>
        page.title.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  )
  return (
    <div className={cx.DashboardStory.overview()}>
      <div className={cx.DashboardStory.overview.toolbar()}>
        <SearchField
          aria-label="Search"
          placeholder="Search…"
          value={search}
          onValueChange={setSearch}
          className={cx.DashboardStory.overview.search()}
        />
        <ToggleGroup
          type="single"
          value={layout}
          onValueChange={value => value && setLayout(value)}
          aria-label="Layout"
        >
          <ToggleGroupItem
            value="cards"
            icon={IcOutlineGridView}
            aria-label="Cards"
          />
          <ToggleGroupItem
            value="table"
            icon={IcOutlineTableRows}
            aria-label="Table"
          />
        </ToggleGroup>
      </div>
      {layout === 'table' ? (
        <Table
          aria-label="Blog"
          items={items}
          rowHeight={56}
          columns={[
            {id: 'thumbnail', header: 'Image', width: 88},
            {id: 'title', header: 'Title', width: '2fr', minWidth: 220},
            {id: 'status', header: 'Status', width: 120},
            {id: 'author', header: 'Author', width: '1fr', collapsible: true},
            {id: 'updated', header: 'Updated', width: 130, collapsible: true}
          ]}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRowAction={onOpen}
          renderEmptyState={() => <Text color="muted">No pages found</Text>}
        >
          {page => (
            <TableRow id={page.id} textValue={page.title}>
              <TableThumbnail src={thumbnail(page.hue)} />
              <TableTitle title={page.title} label={`/${page.path}`} />
              <TableCell>
                <Badge size="sm" status={page.status}>
                  {page.status}
                </Badge>
              </TableCell>
              <TableCell>{page.author}</TableCell>
              <TableCell>{page.updated}</TableCell>
            </TableRow>
          )}
        </Table>
      ) : (
        <ContentGrid
          aria-label="Blog"
          items={items}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onItemAction={onOpen}
          style={{flex: 1}}
        >
          {page => (
            <ContentGridItem id={page.id} textValue={page.title}>
              <ContentCard
                variant="media"
                image={thumbnail(page.hue)}
                title={page.title}
                breadcrumbs={['Pages', 'Blog']}
                description={page.type}
                details={page.updated}
              />
            </ContentGridItem>
          )}
        </ContentGrid>
      )}
    </div>
  )
}

function EntryAside({page}: {page: StoryPage}) {
  return (
    <Sidebar side="right" aria-label="Entry">
      <Tabs defaultValue="preview" className={cx.DashboardStory.aside()}>
        <TabsList aria-label="Sidebar">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <div className={cx.DashboardStory.aside.panel()}>
            <div className={cx.DashboardStory.previewBar()}>
              <Button
                variant="ghost"
                size="icon-sm"
                icon={IcRoundArrowBack}
                aria-label="Back"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                icon={IcRoundArrowForward}
                aria-label="Forward"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                icon={IcRoundRefresh}
                aria-label="Reload"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                icon={IcRoundOpenInNew}
                aria-label="Open in new tab"
              />
            </div>
            <div className={cx.DashboardStory.preview()}>
              <Text color="muted">Live preview of /{page.path}</Text>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className={cx.DashboardStory.aside.panel()}>
            <Heading as="h3" size="xs">
              Current versions
            </Heading>
            <List>
              <ListItem
                selected
                leading={
                  <ListItemVisual>
                    <IcRoundEdit />
                  </ListItemVisual>
                }
                trailing={<Badge size="sm">Editing</Badge>}
              >
                <ListItemTitle>Draft</ListItemTitle>
                <ListItemDescription>Els · 2 minutes ago</ListItemDescription>
              </ListItem>
              <ListItem
                leading={
                  <ListItemVisual>
                    <IcRoundCheck />
                  </ListItemVisual>
                }
              >
                <ListItemTitle>Published</ListItemTitle>
                <ListItemDescription>Niels · yesterday</ListItemDescription>
              </ListItem>
            </List>
            <Collapsible>
              <CollapsibleTrigger>Previous versions</CollapsibleTrigger>
              <CollapsibleContent>
                <Text as="p" size="sm" color="muted">
                  Revisions are read from <Code>git log</Code> of the content
                  file.
                </Text>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>
        <TabsContent value="references">
          <div className={cx.DashboardStory.aside.panel()}>
            <List>
              <ListItem
                leading={
                  <ListItemVisual>
                    <IcRoundLink />
                  </ListItemVisual>
                }
                trailing={
                  <ListItemStatus tone="positive">Published</ListItemStatus>
                }
              >
                <ListItemTitle>Home</ListItemTitle>
                <ListItemDescription>Featured · / · EN</ListItemDescription>
              </ListItem>
              <ListItem
                leading={
                  <ListItemVisual>
                    <IcRoundLanguage />
                  </ListItemVisual>
                }
                trailing={<ListItemStatus tone="warning">Draft</ListItemStatus>}
              >
                <ListItemTitle>Newsletter september</ListItemTitle>
                <ListItemDescription>
                  Articles · /newsletter · NL
                </ListItemDescription>
              </ListItem>
            </List>
          </div>
        </TabsContent>
      </Tabs>
    </Sidebar>
  )
}

/**
 * The dashboard chrome composed from alinea/components only: an AppShell
 * with a NavRail of roots, resizable sidebars and a Page,
 * a sidebar with workspace and language menus, search and create dialogs and
 * a page tree, an entry header with actions, the edit form with fields and a
 * reorderable list, an overview with table and card views, and the entry
 * sidebar with preview, history and references.
 */
export function Composition() {
  const [selected, setSelected] = useState<Key>('launch')
  const [view, setView] = useState('edit')
  const [asideOpen, setAsideOpen] = useState(true)
  const [dirty, setDirty] = useState(false)
  const page = pages.find(page => page.id === selected) ?? pages[0]
  const showAside = asideOpen && view === 'edit'
  return (
    <div className={cx.DashboardStory()}>
      <AppShell>
        <RootRail />
        <AppShellContent>
          <ResizablePanelGroup>
            <ResizablePanel
              key="sidebar"
              defaultSize={280}
              minSize={220}
              maxSize={420}
              priority="low"
            >
              <ContentSidebar
                selected={selected}
                onSelect={key => {
                  setSelected(key)
                  setView('edit')
                  setDirty(false)
                }}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel key="main" minSize={480} priority="high">
              <SidebarInset>
                <ResizablePanelGroup>
                  <ResizablePanel key="page" minSize={400} priority="high">
                    <Page>
                      <EditorHeader
                        page={page}
                        view={view}
                        onViewChange={setView}
                        asideOpen={asideOpen}
                        onAsideOpenChange={setAsideOpen}
                        dirty={dirty}
                      />
                      <PageContent
                        contained={view === 'edit'}
                        className={cx.DashboardStory.body()}
                      >
                        {view === 'edit' ? (
                          <EditorForm
                            key={page.id}
                            page={page}
                            onChange={() => setDirty(true)}
                          />
                        ) : (
                          <Overview
                            onOpen={key => {
                              setSelected(key)
                              setView('edit')
                            }}
                          />
                        )}
                      </PageContent>
                    </Page>
                  </ResizablePanel>
                  {showAside && <ResizableHandle key="handle" />}
                  {showAside && (
                    <ResizablePanel
                      key="aside"
                      defaultSize={320}
                      minSize={280}
                      maxSize={560}
                      priority="low"
                    >
                      <EntryAside page={page} />
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
  title: 'Pure components / Dashboard'
}
