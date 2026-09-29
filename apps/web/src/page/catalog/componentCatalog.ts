export interface ComponentCatalogItem {
  /** The main export, also the name of the module in alinea/components */
  name: string
  description: string
  /** Every export of the module, the main one first */
  parts: Array<string>
  /** Extra search terms */
  keywords?: string
  /** Lays out a large catalog thumbnail at a width and scales it down */
  preview?: {width?: number; scale?: number}
}

export interface ComponentCatalogGroup {
  id: string
  /** Short label for the filter tabs */
  label: string
  title: string
  items: Array<ComponentCatalogItem>
}

export const componentCatalog: Array<ComponentCatalogGroup> = [
  {
    id: 'actions',
    label: 'Actions',
    title: 'Actions and navigation',
    items: [
      {
        name: 'Button',
        description:
          'Triggers an action, in solid, outline, ghost and link variants.',
        parts: ['Button']
      },
      {
        name: 'Toggle',
        description: 'A button that stays pressed until it is pressed again.',
        parts: ['Toggle']
      },
      {
        name: 'ToggleGroup',
        description: 'A row of toggles where one or several can be pressed.',
        parts: ['ToggleGroup', 'ToggleGroupItem'],
        keywords: 'segmented control'
      },
      {
        name: 'Toolbar',
        description: 'Groups buttons and toggles, like a text editor toolbar.',
        parts: [
          'Toolbar',
          'ToolbarGroup',
          'ToolbarButton',
          'ToolbarToggleGroup',
          'ToolbarToggleItem',
          'ToolbarSeparator'
        ]
      },
      {
        name: 'Tabs',
        description: 'Layered sections of content, shown one at a time.',
        parts: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent']
      },
      {
        name: 'Breadcrumb',
        description: 'Shows where the current page sits in a hierarchy.',
        parts: [
          'Breadcrumb',
          'BreadcrumbList',
          'BreadcrumbItem',
          'BreadcrumbLink',
          'BreadcrumbPage',
          'BreadcrumbSeparator',
          'BreadcrumbEllipsis'
        ],
        keywords: 'breadcrumbs'
      },
      {
        name: 'Link',
        description: 'An inline link, plain or underlined.',
        parts: ['Link'],
        keywords: 'anchor href'
      },
      {
        name: 'FileTrigger',
        description: 'Opens the file browser from any button.',
        parts: ['FileTrigger'],
        keywords: 'upload'
      }
    ]
  },
  {
    id: 'forms',
    label: 'Forms',
    title: 'Forms',
    items: [
      {
        name: 'TextField',
        description: 'A labelled single or multiline text input.',
        parts: ['TextField'],
        keywords: 'input textarea'
      },
      {
        name: 'NumberField',
        description: 'A number input with increment and decrement buttons.',
        parts: ['NumberField']
      },
      {
        name: 'SearchField',
        description: 'A text input for search queries, with a clear button.',
        parts: ['SearchField']
      },
      {
        name: 'Select',
        description: 'Picks a single value from a list of options.',
        parts: ['Select', 'SelectItem', 'SelectGroup', 'SelectSeparator'],
        keywords: 'dropdown'
      },
      {
        name: 'MultipleSelect',
        description: 'Picks several values, shown as tags in the field.',
        parts: ['MultipleSelect', 'MultipleSelectItem'],
        preview: {width: 300, scale: 0.9}
      },
      {
        name: 'ComboBox',
        description: 'A text input that filters a list of options.',
        parts: ['ComboBox', 'ComboBoxItem'],
        keywords: 'autocomplete'
      },
      {
        name: 'Checkbox',
        description: 'A single checkbox with a label.',
        parts: ['Checkbox']
      },
      {
        name: 'CheckboxGroup',
        description: 'A labelled group of checkboxes for several values.',
        parts: ['CheckboxGroup']
      },
      {
        name: 'RadioGroup',
        description: 'Picks one value from a small set of options.',
        parts: ['RadioGroup', 'RadioGroupItem']
      },
      {
        name: 'Switch',
        description: 'Turns a setting on or off.',
        parts: ['Switch'],
        keywords: 'toggle'
      },
      {
        name: 'DateField',
        description: 'Types a date segment by segment.',
        parts: ['DateField']
      },
      {
        name: 'TimeField',
        description: 'Types a time of day segment by segment.',
        parts: ['TimeField']
      },
      {
        name: 'DatePicker',
        description: 'A date field with a calendar popover.',
        parts: ['DatePicker']
      },
      {
        name: 'DateRangePicker',
        description: 'Picks a start and end date from a calendar.',
        parts: ['DateRangePicker'],
        preview: {width: 300, scale: 0.9}
      },
      {
        name: 'Calendar',
        description: 'A month grid to pick a date or a range of dates.',
        parts: ['Calendar', 'RangeCalendar'],
        preview: {width: 260, scale: 0.55}
      },
      {
        name: 'TagGroup',
        description: 'A list of tags that can be selected or removed.',
        parts: ['TagGroup', 'Tag'],
        keywords: 'chips'
      },
      {
        name: 'ColorSwatchPicker',
        description: 'Picks a color from a set of swatches.',
        parts: ['ColorSwatchPicker', 'ColorSwatchPickerItem', 'ColorSwatch'],
        keywords: 'color'
      },
      {
        name: 'DropZone',
        description: 'A target to drop files or other content on.',
        parts: ['DropZone', 'DropZoneTrigger', 'DropZoneDescription'],
        keywords: 'upload drag',
        preview: {width: 320, scale: 0.85}
      },
      {
        name: 'Field',
        description: 'The label, help text and error around your own input.',
        parts: [
          'Field',
          'FieldLabel',
          'FieldDescription',
          'FieldError',
          'FieldSharedBadge'
        ],
        keywords: 'label'
      }
    ]
  },
  {
    id: 'collections',
    label: 'Collections',
    title: 'Collections',
    items: [
      {
        name: 'Table',
        description: 'Rows and columns with sorting, selection and dragging.',
        parts: [
          'Table',
          'TableRow',
          'TableCell',
          'TableThumbnail',
          'TableTitle'
        ],
        keywords: 'grid data',
        preview: {width: 460, scale: 0.64}
      },
      {
        name: 'List',
        description: 'A list of items with a visual, title and status.',
        parts: [
          'List',
          'ListItem',
          'ListItemVisual',
          'ListItemTitle',
          'ListItemDescription',
          'ListItemStatus',
          'ListEmpty',
          'ListLabel',
          'ListError'
        ],
        preview: {width: 360, scale: 0.8}
      },
      {
        name: 'SortableList',
        description: 'Rows that editors reorder by dragging, like list fields.',
        parts: [
          'SortableList',
          'SortableListItem',
          'SortableListItemHeader',
          'SortableListHandle',
          'SortableListItemTitle',
          'SortableListItemDescription',
          'SortableListItemActions',
          'SortableListItemToggle',
          'SortableListItemContent',
          'SortableListItemFooter',
          'SortableListItemSettings',
          'SortableListDragPreview',
          'SortableListAdd'
        ],
        keywords: 'drag reorder',
        preview: {width: 400, scale: 0.7}
      },
      {
        name: 'Tree',
        description: 'Nested items that expand and collapse.',
        parts: ['Tree', 'TreeItem'],
        preview: {scale: 0.8}
      },
      {
        name: 'DataList',
        description: 'Label and value pairs, such as the details of a file.',
        parts: ['DataList', 'DataListItem', 'DataListLabel', 'DataListValue'],
        keywords: 'description list'
      },
      {
        name: 'ContentGrid',
        description: 'A selectable grid of cards, like the media library.',
        parts: ['ContentGrid', 'ContentGridItem'],
        preview: {width: 640, scale: 0.45}
      },
      {
        name: 'ContentCard',
        description: 'A card with a preview, title and details.',
        parts: ['ContentCard', 'ContentCardSkeleton'],
        preview: {width: 460, scale: 0.6}
      },
      {
        name: 'MediaPreview',
        description: 'A thumbnail of an image or an icon for other files.',
        parts: ['MediaPreview'],
        keywords: 'image thumbnail',
        preview: {width: 320, scale: 0.85}
      }
    ]
  },
  {
    id: 'overlays',
    label: 'Overlays',
    title: 'Overlays',
    items: [
      {
        name: 'Dialog',
        description: 'A modal window that asks for a decision or input.',
        parts: [
          'Dialog',
          'DialogTrigger',
          'DialogContent',
          'DialogHeader',
          'DialogTitle',
          'DialogDescription',
          'DialogFooter',
          'DialogClose',
          'useDialog'
        ],
        keywords: 'modal'
      },
      {
        name: 'DropdownMenu',
        description: 'A menu of actions that opens from a button.',
        parts: [
          'DropdownMenu',
          'DropdownMenuTrigger',
          'DropdownMenuContent',
          'DropdownMenuItem',
          'DropdownMenuCheckboxItem',
          'DropdownMenuRadioGroup',
          'DropdownMenuRadioItem',
          'DropdownMenuGroup',
          'DropdownMenuLabel',
          'DropdownMenuSeparator',
          'DropdownMenuShortcut',
          'DropdownMenuSub',
          'DropdownMenuSubTrigger',
          'DropdownMenuSubContent'
        ],
        keywords: 'context menu'
      },
      {
        name: 'Popover',
        description: 'Rich content in a panel next to its trigger.',
        parts: ['Popover', 'PopoverTrigger', 'PopoverAnchor', 'PopoverContent']
      },
      {
        name: 'Tooltip',
        description: 'A short description shown on hover or focus.',
        parts: ['Tooltip', 'TooltipTrigger', 'TooltipContent']
      },
      {
        name: 'Command',
        description: 'A searchable list of commands, like a command palette.',
        parts: [
          'Command',
          'CommandInput',
          'CommandList',
          'CommandEmpty',
          'CommandGroup',
          'CommandItem',
          'CommandSeparator'
        ],
        keywords: 'palette search',
        preview: {scale: 0.72}
      }
    ]
  },
  {
    id: 'feedback',
    label: 'Feedback',
    title: 'Feedback and text',
    items: [
      {
        name: 'Alert',
        description: 'A callout for an important message.',
        parts: ['Alert', 'AlertTitle', 'AlertDescription', 'AlertActions'],
        keywords: 'callout notice'
      },
      {
        name: 'Badge',
        description: 'A small label, colored like an entry status.',
        parts: ['Badge'],
        keywords: 'status tag'
      },
      {
        name: 'Empty',
        description: 'The placeholder for a view without content.',
        parts: [
          'Empty',
          'EmptyHeader',
          'EmptyMedia',
          'EmptyTitle',
          'EmptyDescription',
          'EmptyContent'
        ],
        keywords: 'empty state',
        preview: {scale: 0.7}
      },
      {
        name: 'Spinner',
        description: 'Shows that something is loading.',
        parts: ['Spinner'],
        keywords: 'loader loading'
      },
      {
        name: 'Timestamp',
        description:
          'A date shown relative to now, with the full date on hover.',
        parts: ['Timestamp'],
        keywords: 'time ago',
        preview: {width: 320, scale: 0.9}
      },
      {
        name: 'Heading',
        description: 'A title in one of five sizes.',
        parts: ['Heading'],
        keywords: 'typography',
        preview: {width: 360, scale: 0.75}
      },
      {
        name: 'Text',
        description: 'Body text with sizes, weights and colors.',
        parts: ['Text'],
        keywords: 'typography paragraph',
        preview: {width: 360, scale: 0.7}
      },
      {
        name: 'Code',
        description: 'Inline code, soft, outlined or plain.',
        parts: ['Code'],
        keywords: 'typography monospace',
        preview: {width: 420, scale: 0.6}
      },
      {
        name: 'Kbd',
        description: 'A keyboard key or shortcut.',
        parts: ['Kbd'],
        keywords: 'shortcut keyboard'
      },
      {
        name: 'Blockquote',
        description: 'A quotation set apart from the text.',
        parts: ['Blockquote'],
        keywords: 'typography quote',
        preview: {width: 360, scale: 0.8}
      },
      {
        name: 'Icon',
        description: 'Renders an icon component at the text size.',
        parts: ['Icon'],
        keywords: 'svg'
      },
      {
        name: 'FoldIcon',
        description: 'A chevron that turns when its section opens.',
        parts: ['FoldIcon'],
        keywords: 'chevron'
      }
    ]
  },
  {
    id: 'layout',
    label: 'Layout',
    title: 'Layout',
    items: [
      {
        name: 'Surface',
        description: 'A bordered panel for a group of content.',
        parts: ['Surface', 'SurfaceHeader', 'SurfaceContent', 'SurfaceRow'],
        keywords: 'card panel',
        preview: {width: 360, scale: 0.75}
      },
      {
        name: 'Collapsible',
        description: 'A section that opens and closes.',
        parts: ['Collapsible', 'CollapsibleTrigger', 'CollapsibleContent'],
        keywords: 'disclosure accordion'
      },
      {
        name: 'Page',
        description: 'The header, content and footer of a dashboard page.',
        parts: [
          'Page',
          'PageHeader',
          'PageBack',
          'PageTitle',
          'PageActions',
          'PageContent',
          'PageFooter'
        ],
        preview: {width: 560, scale: 0.5}
      },
      {
        name: 'AppShell',
        description: 'The frame of a full dashboard view.',
        parts: ['AppShell', 'AppShellContent'],
        preview: {width: 640, scale: 0.45}
      },
      {
        name: 'Sidebar',
        description: 'A side panel with groups of navigation.',
        parts: [
          'Sidebar',
          'SidebarHeader',
          'SidebarContent',
          'SidebarFooter',
          'SidebarGroup',
          'SidebarGroupLabel',
          'SidebarGroupAction',
          'SidebarInset'
        ],
        preview: {width: 280, scale: 0.5}
      },
      {
        name: 'NavRail',
        description: 'A narrow bar of icon links to switch sections.',
        parts: [
          'NavRail',
          'NavRailHeader',
          'NavRailContent',
          'NavRailItem',
          'NavRailFooter'
        ],
        keywords: 'navigation',
        preview: {scale: 0.65}
      },
      {
        name: 'ResizablePanelGroup',
        description: 'Panels with handles to resize them.',
        parts: ['ResizablePanelGroup', 'ResizablePanel', 'ResizableHandle'],
        keywords: 'resizable split',
        preview: {width: 560, scale: 0.5}
      },
      {
        name: 'PreviewFrame',
        description: 'A device frame for a live preview, with its toolbar.',
        parts: ['PreviewFrame', 'PreviewToolbar'],
        keywords: 'iframe',
        preview: {width: 420, scale: 0.6}
      }
    ]
  }
]

/** The url of a component's docs page */
export function componentHref(name: string) {
  return `/docs/components/${componentSlug(name)}`
}

export function componentSlug(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

export function findComponent(name: string) {
  for (const group of componentCatalog)
    for (const item of group.items) if (item.name === name) return item
  return undefined
}

/** The module in alinea/components that exports a component */
export function componentModule(name: string) {
  if (name === 'Breadcrumb') return 'Breadcrumbs'
  if (name === 'ResizablePanelGroup') return 'Resizable'
  return name
}

/**
 * Live examples shown on the component pages. The id is the file name of the
 * example in ./examples. A `Preview` example is the thumbnail in the catalog,
 * otherwise the example named after the component is used.
 */
export const componentExampleIds = [
  'Button',
  'ButtonVariants',
  'ButtonColors',
  'ButtonSizes',
  'ButtonIcons',
  'TextField',
  'TextFieldStates',
  'TextFieldMultiline',
  'TextFieldIcons',
  'Select',
  'SelectGroups',
  'SelectStates',
  'Checkbox',
  'CheckboxStates',
  'Switch',
  'SwitchStates',
  'Tabs',
  'TabsVariants',
  'TabsVertical',
  'DialogPreview',
  'Dialog',
  'DialogAlert',
  'DialogForm',
  'DropdownMenuPreview',
  'DropdownMenu',
  'DropdownMenuSelection',
  'PopoverPreview',
  'Popover',
  'TooltipPreview',
  'Tooltip',
  'TooltipSides',
  'Table',
  'TableSelection',
  'Badge',
  'BadgeStatuses',
  'BadgeIcons',
  'Alert',
  'AlertVariants',
  'AlertActions',
  'Toggle',
  'ToggleGroup',
  'Toolbar',
  'Breadcrumb',
  'Link',
  'FileTrigger',
  'NumberField',
  'SearchField',
  'MultipleSelect',
  'ComboBox',
  'CheckboxGroup',
  'RadioGroup',
  'DateField',
  'TimeField',
  'DatePicker',
  'DateRangePicker',
  'Calendar',
  'TagGroup',
  'ColorSwatchPicker',
  'DropZone',
  'Field',
  'List',
  'SortableList',
  'Tree',
  'DataList',
  'ContentGrid',
  'ContentCard',
  'MediaPreview',
  'Command',
  'Empty',
  'Spinner',
  'Timestamp',
  'Heading',
  'Text',
  'Code',
  'Kbd',
  'Blockquote',
  'Icon',
  'FoldIcon',
  'Surface',
  'Collapsible',
  'Page',
  'AppShell',
  'Sidebar',
  'NavRail',
  'ResizablePanelGroup',
  'PreviewFrame'
] as const

export type ComponentExampleId = (typeof componentExampleIds)[number]

export function isComponentExampleId(id: string): id is ComponentExampleId {
  return (componentExampleIds as ReadonlyArray<string>).includes(id)
}

/** The catalog thumbnail of a component */
export function componentPreviewId(
  name: string
): ComponentExampleId | undefined {
  const preview = `${name}Preview`
  if (isComponentExampleId(preview)) return preview
  return isComponentExampleId(name) ? name : undefined
}

/** "ButtonVariants" becomes "Button: variants" */
export function exampleLabel(id: string) {
  const component = componentCatalog
    .flatMap(group => group.items)
    .map(item => item.name)
    .filter(name => id.startsWith(name))
    .sort((a, b) => b.length - a.length)[0]
  if (!component) return id
  const rest = id.slice(component.length)
  if (!rest) return component
  return `${component}: ${rest.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}`
}
