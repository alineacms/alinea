import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  IcOutlineSettings,
  IcOutlineTableRows,
  IcOutlineViewList,
  IcRoundAdd,
  IcRoundArchive,
  IcRoundArrowDropDownCircle,
  IcRoundCallSplit,
  IcRoundCheck,
  IcRoundCheckBox,
  IcRoundDateRange,
  IcRoundDelete,
  IcRoundDownload,
  IcRoundEdit,
  IcRoundEmail,
  IcRoundInfo,
  IcRoundMoreHoriz,
  IcRoundNotes,
  IcRoundPhone,
  IcRoundRadioButtonChecked,
  IcRoundRule,
  IcRoundSend,
  IcRoundShortText,
  IcRoundStarOutline,
  IcRoundUploadFile,
  IcRoundWarning,
  LucideFile,
  LucideImage,
  MaterialSymbolsRightPanelCloseRounded
} from '#/dashboard/icons.js'
import {Alert, AlertActions, AlertDescription, AlertTitle} from './Alert.js'
import {AppShell, AppShellContent} from './AppShell.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue
} from './DataList.js'
import {DateRangePicker} from './DateRangePicker.js'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './Dialog.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './DropdownMenu.js'
import styles from './FormBuilder.stories.module.css'
import {
  List,
  ListItem,
  ListItemDescription,
  ListItemTitle,
  ListItemVisual,
  ListLabel
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
import {Page, PageActions, PageContent, PageHeader, PageTitle} from './Page.js'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from './Resizable.js'
import {SearchField} from './SearchField.js'
import {Select, SelectGroup, SelectItem} from './Select.js'
import {
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle
} from './Sheet.js'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset
} from './Sidebar.js'
import {
  SortableList,
  SortableListAdd,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListItemDescription,
  SortableListItemHeader,
  SortableListItemTitle
} from './SortableList.js'
import {Surface} from './Surface.js'
import {Switch} from './Switch.js'
import {Table, TableCell, TableRow, TableTitle} from './Table.js'
import {Text} from './Text.js'
import {TextField} from './TextField.js'
import {Timestamp} from './Timestamp.js'
import {ToggleGroup, ToggleGroupItem} from './ToggleGroup.js'
import {Tree, TreeItem} from './Tree.js'
import type {IconType} from './types.js'

const cx = styler(styles)

type EntryView = 'form' | 'submissions' | 'notifications'

interface StoryShellProps {
  view: EntryView
  status?: 'published' | 'draft'
  aside?: ReactNode
  asideSize?: number
  children: ReactNode
}

/** The dashboard chrome around a form entry */
function StoryShell({
  view,
  status = 'published',
  aside,
  asideSize = 400,
  children
}: StoryShellProps) {
  return (
    <div className={cx.FormBuilderStory()}>
      <AppShell>
        <NavRail aria-label="Roots">
          <NavRailHeader>
            <span className={cx.FormBuilderStory.logo()} aria-hidden>
              a
            </span>
          </NavRailHeader>
          <NavRailContent>
            <NavRailItem icon={LucideFile} label="Pages" />
            <NavRailItem icon={IcRoundRule} label="Forms" active />
            <NavRailItem icon={LucideImage} label="Media" />
          </NavRailContent>
          <NavRailFooter>
            <Button
              variant="ghost"
              size="icon-lg"
              icon={IcOutlineSettings}
              aria-label="Profile"
            />
          </NavRailFooter>
        </NavRail>
        <AppShellContent>
          <ResizablePanelGroup>
            <ResizablePanel key="sidebar" defaultSize={248} minSize={220}>
              <Sidebar aria-label="Content">
                <SidebarHeader>
                  <Text weight="semibold">Main site</Text>
                </SidebarHeader>
                <SidebarContent scroll>
                  <SidebarGroup>
                    <SidebarGroupLabel>Forms</SidebarGroupLabel>
                    <Tree
                      aria-label="Forms"
                      selectionMode="single"
                      selectedKeys={new Set(['service'])}
                    >
                      <TreeItem
                        id="contact"
                        title="Contact"
                        icon={IcRoundRule}
                      />
                      <TreeItem
                        id="service"
                        title="Service request"
                        icon={IcRoundRule}
                      />
                      <TreeItem
                        id="workshop"
                        title="Workshop sign-up"
                        icon={IcRoundRule}
                      />
                      <TreeItem
                        id="openday"
                        title="Open day"
                        icon={IcRoundRule}
                      />
                    </Tree>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel key="main" minSize={480}>
              <SidebarInset>
                <ResizablePanelGroup>
                  <ResizablePanel key="page" minSize={400}>
                    <Page>
                      <PageHeader size="lg">
                        <PageTitle>Service request</PageTitle>
                        <ToggleGroup
                          type="single"
                          value={view}
                          aria-label="View"
                        >
                          <ToggleGroupItem value="form" icon={IcRoundEdit}>
                            Form
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="submissions"
                            icon={IcOutlineTableRows}
                          >
                            Submissions
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="notifications"
                            icon={IcRoundSend}
                          >
                            Notifications
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <Badge status={status}>{status}</Badge>
                        <PageActions>
                          <Button
                            variant="outline"
                            disabled={status !== 'draft'}
                          >
                            Save draft
                          </Button>
                          <Button color="primary">Publish</Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            icon={MaterialSymbolsRightPanelCloseRounded}
                            aria-label="Close sidebar"
                          />
                        </PageActions>
                      </PageHeader>
                      <PageContent
                        contained={view !== 'submissions'}
                        className={cx.FormBuilderStory.body()}
                      >
                        {children}
                      </PageContent>
                    </Page>
                  </ResizablePanel>
                  {aside && <ResizableHandle key="handle" />}
                  {aside && (
                    <ResizablePanel
                      key="aside"
                      defaultSize={asideSize}
                      minSize={320}
                    >
                      {aside}
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

const kinds = {
  section: {icon: IcOutlineViewList, label: 'Section'},
  text: {icon: IcRoundShortText, label: 'Text'},
  email: {icon: IcRoundEmail, label: 'Email'},
  tel: {icon: IcRoundPhone, label: 'Phone'},
  textarea: {icon: IcRoundNotes, label: 'Textarea'},
  radio: {icon: IcRoundRadioButtonChecked, label: 'Radio'},
  select: {icon: IcRoundArrowDropDownCircle, label: 'Select'},
  checkboxes: {icon: IcRoundCheckBox, label: 'Checkboxes'},
  check: {icon: IcRoundCheckBox, label: 'Check'},
  date: {icon: IcRoundDateRange, label: 'Date'},
  file: {icon: IcRoundUploadFile, label: 'File'},
  rating: {icon: IcRoundStarOutline, label: 'Rating'}
} satisfies Record<string, {icon: IconType; label: string}>

type Kind = keyof typeof kinds

interface InputRowProps {
  id: string
  kind: Kind
  label: string
  required?: boolean
  /** Summary of the condition that shows this input */
  shownIf?: string
  /** Number of inputs whose rules use this one */
  controls?: number
  /** Used by a rule of the input whose settings are open */
  usedByCurrent?: boolean
  error?: string
  current?: boolean
  children?: ReactNode
}

/** A row of the inputs list, with badges that summarise its settings */
function InputRow({
  id,
  kind,
  label,
  required,
  shownIf,
  controls,
  usedByCurrent,
  error,
  current,
  children
}: InputRowProps) {
  const {icon, label: kindLabel} = kinds[kind]
  return (
    <SortableListItem id={id} aria-label={label} current={current}>
      <SortableListItemHeader>
        <SortableListItemTitle>
          <Badge icon={icon} size="sm">
            {kindLabel}
          </Badge>
          <SortableListItemDescription>{label}</SortableListItemDescription>
          {required && <Badge size="sm">Required</Badge>}
          {shownIf && (
            <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
              Shown if {shownIf}
            </Badge>
          )}
          {controls !== undefined && (
            <Badge size="sm" icon={IcRoundCallSplit}>
              Controls {controls} {controls === 1 ? 'input' : 'inputs'}
            </Badge>
          )}
          {usedByCurrent && (
            <Badge size="sm" color="primary">
              Used in the rules of Screenshots
            </Badge>
          )}
          {error && (
            <Text size="sm" className={cx.FormBuilderStory.error()}>
              {error}
            </Text>
          )}
        </SortableListItemTitle>
        <SortableListItemActions>
          <Button
            variant="ghost"
            size="icon-sm"
            icon={IcRoundMoreHoriz}
            aria-label={`${label} settings`}
          />
        </SortableListItemActions>
      </SortableListItemHeader>
      {children && (
        <SortableListItemContent>{children}</SortableListItemContent>
      )}
    </SortableListItem>
  )
}

interface InputsProps {
  current?: string
  usedBy?: Array<string>
  broken?: boolean
}

/** The inputs of the Service request form */
function Inputs({current, usedBy = [], broken}: InputsProps) {
  return (
    <div>
      <ListLabel expanded hasRows>
        Inputs
      </ListLabel>
      <SortableList aria-label="Inputs" onReorder={() => {}}>
        <InputRow id="about" kind="section" label="About you">
          <SortableList aria-label="About you" onReorder={() => {}}>
            <InputRow id="name" kind="text" label="Name" required />
            <InputRow id="email" kind="email" label="Email" required />
            <InputRow id="phone" kind="tel" label="Phone" />
          </SortableList>
        </InputRow>
        <InputRow id="request" kind="section" label="Your request">
          <SortableList aria-label="Your request" onReorder={() => {}}>
            {!broken && (
              <InputRow
                id="service"
                kind="radio"
                label="Service"
                required
                controls={3}
                usedByCurrent={usedBy.includes('service')}
                current={current === 'service'}
              />
            )}
            <InputRow
              id="device"
              kind="select"
              label="Device"
              shownIf={broken ? undefined : 'Service is IT'}
              controls={1}
              usedByCurrent={usedBy.includes('device')}
              error={
                broken ? 'Its rule uses Service, which was removed' : undefined
              }
            />
            <InputRow
              id="room"
              kind="text"
              label="Room number"
              shownIf={broken ? undefined : 'Service is Facilities'}
              error={
                broken ? 'Its rule uses Service, which was removed' : undefined
              }
            />
            <InputRow
              id="description"
              kind="textarea"
              label="Description"
              required
              current={current === 'description'}
            />
            <InputRow
              id="screenshots"
              kind="file"
              label="Screenshots"
              shownIf={broken ? undefined : '2 rules match'}
              current={current === 'screenshots'}
              error={
                broken ? 'Its rule uses Service, which was removed' : undefined
              }
            />
            <InputRow
              id="rating"
              kind="rating"
              label="How did we do last time?"
            />
          </SortableList>
        </InputRow>
        <InputRow
          id="consent"
          kind="check"
          label="I agree to the privacy policy"
          required
        />
        <SortableListAdd>
          <DropdownMenu>
            <DropdownMenuTrigger variant="ghost" size="sm" icon={IcRoundAdd}>
              Add input
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Add input" align="start">
              <DropdownMenuGroup aria-label="Inputs">
                <DropdownMenuLabel>Inputs</DropdownMenuLabel>
                {(
                  [
                    'text',
                    'email',
                    'tel',
                    'textarea',
                    'date',
                    'radio',
                    'checkboxes',
                    'select',
                    'check',
                    'file',
                    'section'
                  ] as const
                ).map(kind => (
                  <DropdownMenuItem key={kind} icon={kinds[kind].icon}>
                    {kinds[kind].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup aria-label="This project">
                <DropdownMenuLabel>This project</DropdownMenuLabel>
                <DropdownMenuItem icon={kinds.rating.icon}>
                  Rating
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SortableListAdd>
      </SortableList>
    </div>
  )
}

interface InputSheetProps {
  kind: Kind
  title: string
  children: ReactNode
}

/** The settings sheet of an input, in place of the entry sidebar */
function InputSheet({kind, title, children}: InputSheetProps) {
  return (
    <Sidebar side="right" aria-label="Input settings">
      <SheetContent backLabel="Back to preview">
        <SheetHeader>
          <Badge icon={kinds[kind].icon} size="sm">
            {kinds[kind].label}
          </Badge>
          <SheetTitle>{title}</SheetTitle>
          <SheetClose aria-label="Close input settings" />
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
        <SheetFooter>
          <Button
            variant="ghost"
            size="sm"
            color="destructive"
            icon={IcRoundDelete}
          >
            Delete input
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sidebar>
  )
}

/** The settings every input shares */
function SharedSettings({
  label,
  name,
  help
}: {
  label: string
  name: string
  help?: string
}) {
  return (
    <SheetSection title="Input">
      <TextField label="Label" defaultValue={label} />
      <TextField
        label="Key"
        defaultValue={name}
        description="Used in exports and in the data sent to your site"
      />
      <TextField label="Help text" defaultValue={help} />
      <Switch defaultChecked>Required</Switch>
      <div className={cx.FormBuilderStory.row()}>
        <Text size="sm" weight="medium">
          Width
        </Text>
        <ToggleGroup type="single" defaultValue="full" aria-label="Width">
          <ToggleGroupItem value="full">Full</ToggleGroupItem>
          <ToggleGroupItem value="half">Half</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </SheetSection>
  )
}

/**
 * Inputs are rows of a list field, one row type per input kind. Their
 * settings open in the sheet, the Add menu lists the built-in inputs and the
 * project's own.
 */
export function Builder() {
  return (
    <StoryShell
      view="form"
      status="draft"
      aside={
        <InputSheet kind="textarea" title="Description">
          <SharedSettings
            label="Description"
            name="description"
            help="Tell us what happened and when"
          />
          <SheetSection title="Textarea">
            <TextField label="Placeholder" />
            <NumberField label="Maximum length" defaultValue={2000} />
          </SheetSection>
          <SheetSection title="Logic" icon={IcRoundCallSplit}>
            <Text size="sm" color="muted">
              Always shown, never disabled
            </Text>
          </SheetSection>
        </InputSheet>
      }
    >
      <Inputs current="description" />
    </StoryShell>
  )
}

interface RuleProps {
  input: string
  op: string
  children: ReactNode
}

function Rule({input, op, children}: RuleProps) {
  return (
    <div className={cx.FormBuilderStory.rule()}>
      <Select aria-label="Input" size="sm" defaultValue={input}>
        <SelectGroup label="About you">
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="phone">Phone</SelectItem>
        </SelectGroup>
        <SelectGroup label="Your request">
          <SelectItem value="service">Service</SelectItem>
          <SelectItem value="device">Device</SelectItem>
          <SelectItem value="room">Room number</SelectItem>
          <SelectItem value="description">Description</SelectItem>
        </SelectGroup>
      </Select>
      <Select aria-label="Operator" size="sm" defaultValue={op}>
        <SelectItem value="is">is</SelectItem>
        <SelectItem value="isNot">is not</SelectItem>
        <SelectItem value="anyOf">is any of</SelectItem>
        <SelectItem value="empty">is empty</SelectItem>
      </Select>
      {children}
      <Button
        variant="ghost"
        size="icon-sm"
        icon={IcRoundDelete}
        aria-label="Remove rule"
      />
    </div>
  )
}

/**
 * Conditions are a Logic tab of each input type, shown as a section of the
 * sheet. Rules pick from the inputs above this one and their options.
 */
export function Logic() {
  return (
    <StoryShell
      view="form"
      status="draft"
      asideSize={440}
      aside={
        <InputSheet kind="file" title="Screenshots">
          <SheetSection title="Logic" icon={IcRoundCallSplit}>
            <div className={cx.FormBuilderStory.row()}>
              <Text size="sm" weight="medium">
                Show this input
              </Text>
              <ToggleGroup type="single" defaultValue="when" aria-label="Show">
                <ToggleGroupItem value="always">Always</ToggleGroupItem>
                <ToggleGroupItem value="when">When…</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Surface>
              <div className={cx.FormBuilderStory.rules()}>
                <div className={cx.FormBuilderStory.row()}>
                  <Text size="sm">Match</Text>
                  <ToggleGroup
                    type="single"
                    defaultValue="all"
                    aria-label="Match"
                  >
                    <ToggleGroupItem value="all">all</ToggleGroupItem>
                    <ToggleGroupItem value="any">any</ToggleGroupItem>
                  </ToggleGroup>
                  <Text size="sm">of these rules</Text>
                </div>
                <Rule input="service" op="is">
                  <Select aria-label="Value" size="sm" defaultValue="it">
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="facilities">Facilities</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                  </Select>
                </Rule>
                <Rule input="device" op="anyOf">
                  <MultipleSelect
                    aria-label="Values"
                    defaultValue={['laptop', 'desktop']}
                  >
                    <MultipleSelectItem value="laptop">
                      Laptop
                    </MultipleSelectItem>
                    <MultipleSelectItem value="desktop">
                      Desktop
                    </MultipleSelectItem>
                    <MultipleSelectItem value="phone">Phone</MultipleSelectItem>
                    <MultipleSelectItem value="printer">
                      Printer
                    </MultipleSelectItem>
                  </MultipleSelect>
                </Rule>
                <div>
                  <Button variant="ghost" size="sm" icon={IcRoundAdd}>
                    Add rule
                  </Button>
                </div>
              </div>
            </Surface>
            <Text size="xs" color="muted">
              Rules can use the inputs above this one.
            </Text>
            <div className={cx.FormBuilderStory.row()}>
              <Text size="sm" weight="medium">
                Disable this input
              </Text>
              <ToggleGroup
                type="single"
                defaultValue="never"
                aria-label="Disable"
              >
                <ToggleGroupItem value="never">Never</ToggleGroupItem>
                <ToggleGroupItem value="when">When…</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Alert icon={IcRoundInfo} role="note">
              <AlertDescription>
                A hidden input is not required, not validated and not stored.
                The same rules run in the preview, on your site and on the
                server.
              </AlertDescription>
            </Alert>
          </SheetSection>
          <SheetSection title="File">
            <TextField label="Accepted files" defaultValue=".png, .jpg, .pdf" />
            <NumberField
              label="Maximum size"
              defaultValue={10}
              formatOptions={{style: 'unit', unit: 'megabyte'}}
            />
          </SheetSection>
        </InputSheet>
      }
    >
      <Inputs current="screenshots" usedBy={['service', 'device']} />
    </StoryShell>
  )
}

/** Deleting an input that rules use asks what to do with the rules first */
export function DeleteInput() {
  return (
    <StoryShell view="form" status="draft">
      <Inputs />
      <Dialog defaultOpen>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Delete Service?</DialogTitle>
            <DialogDescription>
              3 inputs are shown depending on Service: Device, Room number and
              Screenshots. Their rules stop working when Service is deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose variant="ghost">Cancel</DialogClose>
            <DialogClose variant="outline">Keep the rules</DialogClose>
            <DialogClose color="destructive">
              Delete and remove rules
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StoryShell>
  )
}

/**
 * Rules that point at a removed input, a moved one or a removed option are
 * validation errors on the form, so it cannot be published until they are
 * fixed.
 */
export function BrokenRules() {
  return (
    <StoryShell view="form" status="draft">
      <div className={cx.FormBuilderStory.stack()}>
        <Alert variant="destructive" icon={IcRoundWarning} role="alert">
          <AlertTitle>3 rules need attention before you can publish</AlertTitle>
          <AlertDescription>
            Device, Room number and Screenshots are shown when Service has a
            value, but Service was removed.
          </AlertDescription>
          <AlertActions>
            <Button variant="outline" size="sm">
              Remove these rules
            </Button>
            <Button variant="ghost" size="sm">
              Undo delete
            </Button>
          </AlertActions>
        </Alert>
        <Inputs broken />
      </div>
    </StoryShell>
  )
}

interface SiteRowProps {
  label: string
  required?: boolean
  hidden?: string
  help?: string
  children: ReactNode
}

/** A row as the default HTML of `<Form>` renders it, unstyled */
function SiteRow({label, required, hidden, help, children}: SiteRowProps) {
  return (
    <div
      className={cx.FormBuilderStory.site.row()}
      data-hidden={hidden ? true : undefined}
    >
      <label>
        {label}
        {required && ' *'}
      </label>
      {children}
      {help && <span className={cx.FormBuilderStory.site.help()}>{help}</span>}
      {hidden && (
        <Badge size="sm" className={cx.FormBuilderStory.site.hiddenNote()}>
          Hidden: {hidden}
        </Badge>
      )}
    </div>
  )
}

/**
 * The preview renders the default HTML of `<Form>` from alinea/ui with the
 * same rules as the site. Editors fill it in to test the conditions, or show
 * the hidden inputs to check the whole form at once.
 */
export function Preview() {
  return (
    <StoryShell
      view="form"
      status="draft"
      asideSize={460}
      aside={
        <Sidebar side="right" aria-label="Preview">
          <div className={cx.FormBuilderStory.preview()}>
            <div className={cx.FormBuilderStory.row()}>
              <Text weight="semibold" className={cx.FormBuilderStory.grow()}>
                Preview
              </Text>
              <Switch defaultChecked>Show hidden inputs</Switch>
            </div>
            <form className={cx.FormBuilderStory.site()}>
              <h2 className={cx.FormBuilderStory.site.title()}>
                Service request
              </h2>
              <fieldset className={cx.FormBuilderStory.site.fieldset()}>
                <legend>Your request</legend>
                <SiteRow label="Service" required>
                  <div>
                    <label>
                      <input type="radio" name="service" /> IT
                    </label>{' '}
                    <label>
                      <input type="radio" name="service" defaultChecked />{' '}
                      Facilities
                    </label>{' '}
                    <label>
                      <input type="radio" name="service" /> Finance
                    </label>
                  </div>
                </SiteRow>
                <SiteRow label="Device" hidden="Service is not IT">
                  <select className={cx.FormBuilderStory.site.control()}>
                    <option>Laptop</option>
                  </select>
                </SiteRow>
                <SiteRow label="Room number">
                  <input
                    className={cx.FormBuilderStory.site.control()}
                    defaultValue="B2.14"
                  />
                </SiteRow>
                <SiteRow
                  label="Description"
                  required
                  help="Tell us what happened and when"
                >
                  <textarea
                    className={cx.FormBuilderStory.site.control()}
                    rows={3}
                    defaultValue="The heating in the meeting room does not work."
                  />
                </SiteRow>
                <SiteRow label="Screenshots" hidden="Service is not IT">
                  <input type="file" />
                </SiteRow>
              </fieldset>
              <label>
                <input type="checkbox" /> I agree to the privacy policy *
              </label>
              <button
                type="button"
                className={cx.FormBuilderStory.site.submit()}
              >
                Send
              </button>
            </form>
          </div>
        </Sidebar>
      }
    >
      <Inputs />
    </StoryShell>
  )
}

/**
 * Notifications are rows of their own list, with the same rule editor to
 * route mails by an answer. The site sends them with its own mailer.
 */
export function Notifications() {
  return (
    <StoryShell
      view="notifications"
      asideSize={440}
      aside={
        <Sidebar side="right" aria-label="Notification settings">
          <SheetContent backLabel="Back to preview">
            <SheetHeader>
              <Badge icon={IcRoundEmail} size="sm">
                Notification
              </Badge>
              <SheetTitle>IT helpdesk</SheetTitle>
              <SheetClose aria-label="Close notification settings" />
            </SheetHeader>
            <SheetBody>
              <SheetSection title="Recipient">
                <ToggleGroup
                  type="single"
                  defaultValue="address"
                  aria-label="Send to"
                >
                  <ToggleGroupItem value="address">An address</ToggleGroupItem>
                  <ToggleGroupItem value="input">An input</ToggleGroupItem>
                </ToggleGroup>
                <TextField
                  label="Address"
                  defaultValue="it-helpdesk@example.com"
                />
                <Select label="Reply to" defaultValue="email">
                  <SelectItem value="email">Email (input)</SelectItem>
                </Select>
              </SheetSection>
              <SheetSection title="Send when" icon={IcRoundCallSplit}>
                <Surface>
                  <div className={cx.FormBuilderStory.rules()}>
                    <Rule input="service" op="is">
                      <Select aria-label="Value" size="sm" defaultValue="it">
                        <SelectItem value="it">IT</SelectItem>
                        <SelectItem value="facilities">Facilities</SelectItem>
                      </Select>
                    </Rule>
                    <div>
                      <Button variant="ghost" size="sm" icon={IcRoundAdd}>
                        Add rule
                      </Button>
                    </div>
                  </div>
                </Surface>
              </SheetSection>
              <SheetSection title="Message">
                <TextField
                  label="Subject"
                  defaultValue="New request from {{name}}: {{device}}"
                />
                <TextField
                  label="Body"
                  multiline
                  rows={5}
                  defaultValue={
                    '{{name}} ({{email}}) asked for help with {{device}}:\n\n{{description}}'
                  }
                  description="Insert answers with {{key}}. Files are sent as links to the dashboard."
                />
              </SheetSection>
            </SheetBody>
          </SheetContent>
        </Sidebar>
      }
    >
      <div className={cx.FormBuilderStory.stack()}>
        <div>
          <ListLabel expanded hasRows>
            Notifications
          </ListLabel>
          <SortableList aria-label="Notifications">
            <SortableListItem aria-label="IT helpdesk" current>
              <SortableListItemHeader>
                <SortableListItemTitle>
                  <Badge icon={IcRoundEmail} size="sm">
                    Mail
                  </Badge>
                  <SortableListItemDescription>
                    IT helpdesk
                  </SortableListItemDescription>
                  <Badge size="sm">it-helpdesk@example.com</Badge>
                  <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
                    When Service is IT
                  </Badge>
                </SortableListItemTitle>
              </SortableListItemHeader>
            </SortableListItem>
            <SortableListItem aria-label="Facilities">
              <SortableListItemHeader>
                <SortableListItemTitle>
                  <Badge icon={IcRoundEmail} size="sm">
                    Mail
                  </Badge>
                  <SortableListItemDescription>
                    Facilities
                  </SortableListItemDescription>
                  <Badge size="sm">facilities@example.com</Badge>
                  <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
                    When Service is Facilities
                  </Badge>
                </SortableListItemTitle>
              </SortableListItemHeader>
            </SortableListItem>
            <SortableListItem aria-label="Confirmation">
              <SortableListItemHeader>
                <SortableListItemTitle>
                  <Badge icon={IcRoundEmail} size="sm">
                    Mail
                  </Badge>
                  <SortableListItemDescription>
                    Confirmation to the sender
                  </SortableListItemDescription>
                  <Badge size="sm">To the Email input</Badge>
                </SortableListItemTitle>
              </SortableListItemHeader>
            </SortableListItem>
            <SortableListAdd>
              <Button variant="ghost" size="sm" icon={IcRoundAdd}>
                Add notification
              </Button>
            </SortableListAdd>
          </SortableList>
        </div>
        <Surface>
          <div className={cx.FormBuilderStory.rules()}>
            <Text weight="semibold">After sending</Text>
            <ToggleGroup
              type="single"
              defaultValue="message"
              aria-label="After sending"
            >
              <ToggleGroupItem value="message">Show a message</ToggleGroupItem>
              <ToggleGroupItem value="redirect">Go to a page</ToggleGroupItem>
            </ToggleGroup>
            <TextField
              label="Message"
              multiline
              rows={2}
              defaultValue="Thanks, we received your request and will reply within two working days."
            />
          </div>
        </Surface>
      </div>
    </StoryShell>
  )
}

interface Submission {
  id: string
  received: string
  name: string
  email: string
  service: string
  device?: string
  room?: string
  status: 'new' | 'read' | 'archived'
}

const submissions: Array<Submission> = [
  {
    id: 's1',
    received: '2026-10-21T09:12:00',
    name: 'Lena Peeters',
    email: 'lena@example.com',
    service: 'IT',
    device: 'Laptop',
    status: 'new'
  },
  {
    id: 's2',
    received: '2026-10-21T08:40:00',
    name: 'Omar Haddad',
    email: 'omar@example.com',
    service: 'Facilities',
    room: 'B2.14',
    status: 'new'
  },
  {
    id: 's3',
    received: '2026-10-20T16:05:00',
    name: 'Sofie Janssens',
    email: 'sofie@example.com',
    service: 'Finance',
    status: 'read'
  },
  {
    id: 's4',
    received: '2026-10-20T11:31:00',
    name: 'Tom De Smet',
    email: 'tom@example.com',
    service: 'IT',
    device: 'Printer',
    status: 'read'
  },
  {
    id: 's5',
    received: '2026-10-19T14:22:00',
    name: 'Anaïs Dubois',
    email: 'anais@example.com',
    service: 'Facilities',
    room: 'A0.03',
    status: 'archived'
  }
]

function NotShown() {
  return <span className={cx.FormBuilderStory.notShown()}>not shown</span>
}

function SubmissionsTable({selected}: {selected?: string}) {
  return (
    <div className={cx.FormBuilderStory.table()}>
      <div className={cx.FormBuilderStory.toolbar()}>
        <SearchField
          aria-label="Search submissions"
          placeholder="Search answers…"
          className={cx.FormBuilderStory.toolbar.search()}
        />
        <DateRangePicker
          aria-label="Received"
          defaultValue={{start: '2026-10-01', end: '2026-10-21'}}
        />
        <div className={cx.FormBuilderStory.toolbar.filter()}>
          <Select aria-label="Service" placeholder="Service">
            <SelectItem value="it">IT</SelectItem>
            <SelectItem value="facilities">Facilities</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
          </Select>
        </div>
        <div className={cx.FormBuilderStory.toolbar.filter()}>
          <Select aria-label="Status" defaultValue="open">
            <SelectItem value="open">New and read</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </Select>
        </div>
        <Button variant="outline" icon={IcRoundDownload}>
          Export CSV
        </Button>
      </div>
      <Table
        aria-label="Submissions"
        items={submissions}
        rowHeight={48}
        columns={[
          {id: 'name', header: 'Name', width: '1.4fr', minWidth: 180},
          {id: 'received', header: 'Received', width: 150},
          {id: 'service', header: 'Service', width: 110},
          {id: 'device', header: 'Device', width: 110, collapsible: true},
          {id: 'room', header: 'Room number', width: 120, collapsible: true},
          {id: 'status', header: 'Status', width: 100}
        ]}
        selectionMode="multiple"
        selectedKeys={new Set(selected ? [selected] : [])}
      >
        {item => (
          <TableRow id={item.id} textValue={item.name}>
            <TableTitle title={item.name} label={item.email} />
            <TableCell>
              <Timestamp date={item.received} format="datetime" />
            </TableCell>
            <TableCell>
              <Badge size="sm">{item.service}</Badge>
            </TableCell>
            <TableCell>{item.device ?? <NotShown />}</TableCell>
            <TableCell>{item.room ?? <NotShown />}</TableCell>
            <TableCell>
              <Badge
                size="sm"
                color={item.status === 'new' ? 'primary' : 'default'}
                icon={item.status === 'archived' ? IcRoundArchive : undefined}
              >
                {item.status}
              </Badge>
            </TableCell>
          </TableRow>
        )}
      </Table>
    </div>
  )
}

/**
 * Submissions are read through the project's SubmissionsSource. Columns come
 * from the definition, inputs that were hidden show as "not shown".
 */
export function Submissions() {
  return (
    <StoryShell view="submissions">
      <SubmissionsTable />
    </StoryShell>
  )
}

/**
 * One submission, rendered with the definition it was sent with. Files are
 * linked through the handler with short-lived signed urls.
 */
export function SubmissionDetail() {
  return (
    <StoryShell
      view="submissions"
      asideSize={420}
      aside={
        <Sidebar side="right" aria-label="Submission">
          <SheetContent backLabel="Back to submissions">
            <SheetHeader>
              <Badge size="sm" color="primary">
                new
              </Badge>
              <SheetTitle>Lena Peeters</SheetTitle>
              <SheetClose aria-label="Close submission" />
            </SheetHeader>
            <SheetBody>
              <SheetSection title="About you">
                <DataList>
                  <DataListItem>
                    <DataListLabel>Name</DataListLabel>
                    <DataListValue>Lena Peeters</DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>Email</DataListLabel>
                    <DataListValue>lena@example.com</DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>Phone</DataListLabel>
                    <DataListValue>
                      <span className={cx.FormBuilderStory.notShown()}>
                        left empty
                      </span>
                    </DataListValue>
                  </DataListItem>
                </DataList>
              </SheetSection>
              <SheetSection title="Your request">
                <DataList>
                  <DataListItem>
                    <DataListLabel>Service</DataListLabel>
                    <DataListValue>IT</DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>Device</DataListLabel>
                    <DataListValue>Laptop</DataListValue>
                  </DataListItem>
                  <DataListItem full>
                    <DataListLabel>Description</DataListLabel>
                    <DataListValue>
                      The laptop does not connect to the projector in room C1.07
                      since this morning's update.
                    </DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>How did we do last time?</DataListLabel>
                    <DataListValue>4 of 5</DataListValue>
                  </DataListItem>
                </DataList>
                <List>
                  <ListItem
                    leading={
                      <ListItemVisual>
                        <IcRoundUploadFile />
                      </ListItemVisual>
                    }
                    trailing={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={IcRoundDownload}
                        aria-label="Download error.png"
                      />
                    }
                  >
                    <ListItemTitle>error.png</ListItemTitle>
                    <ListItemDescription>
                      Screenshots · 412 KB · private
                    </ListItemDescription>
                  </ListItem>
                </List>
              </SheetSection>
              <SheetSection title="Sent">
                <DataList>
                  <DataListItem>
                    <DataListLabel>Received</DataListLabel>
                    <DataListValue>
                      <Timestamp date="2026-10-21T09:12:00" format="datetime" />
                    </DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>Language</DataListLabel>
                    <DataListValue>Nederlands</DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>Notified</DataListLabel>
                    <DataListValue>IT helpdesk, confirmation</DataListValue>
                  </DataListItem>
                </DataList>
              </SheetSection>
            </SheetBody>
            <SheetFooter>
              <div className={cx.FormBuilderStory.row()}>
                <Button variant="outline" size="sm" icon={IcRoundCheck}>
                  Mark as read
                </Button>
                <Button variant="ghost" size="sm" icon={IcRoundArchive}>
                  Archive
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  color="destructive"
                  icon={IcRoundDelete}
                >
                  Delete
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sidebar>
      }
    >
      <SubmissionsTable selected="s1" />
    </StoryShell>
  )
}

export default {
  title: 'Proposals / Form builder'
}
