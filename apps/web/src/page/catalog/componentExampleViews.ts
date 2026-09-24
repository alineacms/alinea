import type {ComponentType} from 'react'
import type {ComponentExampleId} from './componentCatalog'
import {AlertExample} from './examples/Alert'
import {AlertActionsExample} from './examples/AlertActions'
import {AlertVariantsExample} from './examples/AlertVariants'
import {AppShellExample} from './examples/AppShell'
import {BadgeExample} from './examples/Badge'
import {BadgeIconsExample} from './examples/BadgeIcons'
import {BadgeStatusesExample} from './examples/BadgeStatuses'
import {BlockquoteExample} from './examples/Blockquote'
import {BreadcrumbExample} from './examples/Breadcrumb'
import {ButtonExample} from './examples/Button'
import {ButtonColorsExample} from './examples/ButtonColors'
import {ButtonIconsExample} from './examples/ButtonIcons'
import {ButtonSizesExample} from './examples/ButtonSizes'
import {ButtonVariantsExample} from './examples/ButtonVariants'
import {CalendarExample} from './examples/Calendar'
import {CheckboxExample} from './examples/Checkbox'
import {CheckboxGroupExample} from './examples/CheckboxGroup'
import {CheckboxStatesExample} from './examples/CheckboxStates'
import {CodeExample} from './examples/Code'
import {CollapsibleExample} from './examples/Collapsible'
import {ColorSwatchPickerExample} from './examples/ColorSwatchPicker'
import {ComboBoxExample} from './examples/ComboBox'
import {CommandExample} from './examples/Command'
import {ContentCardExample} from './examples/ContentCard'
import {ContentGridExample} from './examples/ContentGrid'
import {DataListExample} from './examples/DataList'
import {DateFieldExample} from './examples/DateField'
import {DatePickerExample} from './examples/DatePicker'
import {DateRangePickerExample} from './examples/DateRangePicker'
import {DialogExample} from './examples/Dialog'
import {DialogAlertExample} from './examples/DialogAlert'
import {DialogFormExample} from './examples/DialogForm'
import {DialogPreviewExample} from './examples/DialogPreview'
import {DropZoneExample} from './examples/DropZone'
import {DropdownMenuExample} from './examples/DropdownMenu'
import {DropdownMenuPreviewExample} from './examples/DropdownMenuPreview'
import {DropdownMenuSelectionExample} from './examples/DropdownMenuSelection'
import {EmptyExample} from './examples/Empty'
import {FieldExample} from './examples/Field'
import {FileTriggerExample} from './examples/FileTrigger'
import {FoldIconExample} from './examples/FoldIcon'
import {HeadingExample} from './examples/Heading'
import {IconExample} from './examples/Icon'
import {KbdExample} from './examples/Kbd'
import {LinkExample} from './examples/Link'
import {ListExample} from './examples/List'
import {MediaPreviewExample} from './examples/MediaPreview'
import {MultipleSelectExample} from './examples/MultipleSelect'
import {NavRailExample} from './examples/NavRail'
import {NumberFieldExample} from './examples/NumberField'
import {PageExample} from './examples/Page'
import {PopoverExample} from './examples/Popover'
import {PopoverPreviewExample} from './examples/PopoverPreview'
import {PreviewFrameExample} from './examples/PreviewFrame'
import {RadioGroupExample} from './examples/RadioGroup'
import {ResizablePanelGroupExample} from './examples/ResizablePanelGroup'
import {SearchFieldExample} from './examples/SearchField'
import {SelectExample} from './examples/Select'
import {SelectGroupsExample} from './examples/SelectGroups'
import {SelectStatesExample} from './examples/SelectStates'
import {SidebarExample} from './examples/Sidebar'
import {SortableListExample} from './examples/SortableList'
import {SpinnerExample} from './examples/Spinner'
import {SurfaceExample} from './examples/Surface'
import {SwitchExample} from './examples/Switch'
import {SwitchStatesExample} from './examples/SwitchStates'
import {TableExample} from './examples/Table'
import {TableSelectionExample} from './examples/TableSelection'
import {TabsExample} from './examples/Tabs'
import {TabsVariantsExample} from './examples/TabsVariants'
import {TabsVerticalExample} from './examples/TabsVertical'
import {TagGroupExample} from './examples/TagGroup'
import {TextExample} from './examples/Text'
import {TextFieldExample} from './examples/TextField'
import {TextFieldIconsExample} from './examples/TextFieldIcons'
import {TextFieldMultilineExample} from './examples/TextFieldMultiline'
import {TextFieldStatesExample} from './examples/TextFieldStates'
import {TimeFieldExample} from './examples/TimeField'
import {TimestampExample} from './examples/Timestamp'
import {ToggleExample} from './examples/Toggle'
import {ToggleGroupExample} from './examples/ToggleGroup'
import {ToolbarExample} from './examples/Toolbar'
import {TooltipExample} from './examples/Tooltip'
import {TooltipPreviewExample} from './examples/TooltipPreview'
import {TooltipSidesExample} from './examples/TooltipSides'
import {TreeExample} from './examples/Tree'

/** The live examples by id, each is a client component */
export const componentExampleViews = {
  Button: ButtonExample,
  ButtonVariants: ButtonVariantsExample,
  ButtonColors: ButtonColorsExample,
  ButtonSizes: ButtonSizesExample,
  ButtonIcons: ButtonIconsExample,
  TextField: TextFieldExample,
  TextFieldStates: TextFieldStatesExample,
  TextFieldMultiline: TextFieldMultilineExample,
  TextFieldIcons: TextFieldIconsExample,
  Select: SelectExample,
  SelectGroups: SelectGroupsExample,
  SelectStates: SelectStatesExample,
  Checkbox: CheckboxExample,
  CheckboxStates: CheckboxStatesExample,
  Switch: SwitchExample,
  SwitchStates: SwitchStatesExample,
  Tabs: TabsExample,
  TabsVariants: TabsVariantsExample,
  TabsVertical: TabsVerticalExample,
  DialogPreview: DialogPreviewExample,
  Dialog: DialogExample,
  DialogAlert: DialogAlertExample,
  DialogForm: DialogFormExample,
  DropdownMenuPreview: DropdownMenuPreviewExample,
  DropdownMenu: DropdownMenuExample,
  DropdownMenuSelection: DropdownMenuSelectionExample,
  PopoverPreview: PopoverPreviewExample,
  Popover: PopoverExample,
  TooltipPreview: TooltipPreviewExample,
  Tooltip: TooltipExample,
  TooltipSides: TooltipSidesExample,
  Table: TableExample,
  TableSelection: TableSelectionExample,
  Badge: BadgeExample,
  BadgeStatuses: BadgeStatusesExample,
  BadgeIcons: BadgeIconsExample,
  Alert: AlertExample,
  AlertVariants: AlertVariantsExample,
  AlertActions: AlertActionsExample,
  Toggle: ToggleExample,
  ToggleGroup: ToggleGroupExample,
  Toolbar: ToolbarExample,
  Breadcrumb: BreadcrumbExample,
  Link: LinkExample,
  FileTrigger: FileTriggerExample,
  NumberField: NumberFieldExample,
  SearchField: SearchFieldExample,
  MultipleSelect: MultipleSelectExample,
  ComboBox: ComboBoxExample,
  CheckboxGroup: CheckboxGroupExample,
  RadioGroup: RadioGroupExample,
  DateField: DateFieldExample,
  TimeField: TimeFieldExample,
  DatePicker: DatePickerExample,
  DateRangePicker: DateRangePickerExample,
  Calendar: CalendarExample,
  TagGroup: TagGroupExample,
  ColorSwatchPicker: ColorSwatchPickerExample,
  DropZone: DropZoneExample,
  Field: FieldExample,
  List: ListExample,
  SortableList: SortableListExample,
  Tree: TreeExample,
  DataList: DataListExample,
  ContentGrid: ContentGridExample,
  ContentCard: ContentCardExample,
  MediaPreview: MediaPreviewExample,
  Command: CommandExample,
  Empty: EmptyExample,
  Spinner: SpinnerExample,
  Timestamp: TimestampExample,
  Heading: HeadingExample,
  Text: TextExample,
  Code: CodeExample,
  Kbd: KbdExample,
  Blockquote: BlockquoteExample,
  Icon: IconExample,
  FoldIcon: FoldIconExample,
  Surface: SurfaceExample,
  Collapsible: CollapsibleExample,
  Page: PageExample,
  AppShell: AppShellExample,
  Sidebar: SidebarExample,
  NavRail: NavRailExample,
  ResizablePanelGroup: ResizablePanelGroupExample,
  PreviewFrame: PreviewFrameExample
} satisfies Record<ComponentExampleId, ComponentType>
