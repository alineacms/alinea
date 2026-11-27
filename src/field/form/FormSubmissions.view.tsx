import {
  Badge,
  Button,
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  type DateRange,
  DateRangePicker,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  SearchField,
  Select,
  SelectItem,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  Table,
  TableCell,
  TableRow,
  Text
} from '#/components.js'
import type {
  FormFileRef,
  Submission,
  SubmissionPage,
  SubmissionQuery,
  SubmissionStatus
} from '#/core/Connection.js'
import {Field} from '#/core/Field.js'
import {Root, type RootI18n} from '#/core/Root.js'
import {entries} from '#/core/util/Objects.js'
import {
  BlockSheet,
  useCloseBlockSheet,
  useOpenBlockSheet,
  useOpenBlockSheetId
} from '#/dashboard/app/BlockSheet.js'
import {clientAtom, configAtom} from '#/dashboard/atoms/core.js'
import {openSubmissionAtom} from '#/dashboard/atoms/nav.js'
import {
  submissionAtom,
  submissionsVersion
} from '#/dashboard/atoms/submissions.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import {atomWithPending, dispense} from '#/dashboard/atoms/utils.js'
import {
  useEditor,
  useEntry,
  useLocale,
  useOptionalDashboardContext
} from '#/dashboard/hooks.js'
import {useOtherVersions} from '#/dashboard/app/useMissingLanguages.js'
import {
  IcOutlineTableRows,
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundDownload,
  IcRoundUnarchive,
  IcRoundUploadFile
} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {
  type Atom,
  atom,
  useAtomValueRaw,
  useAtomValueRawSync,
  useSetAtom,
  useStore
} from 'jotai'
import {useEffect, useMemo, useRef, useState} from 'react'
import {
  type FormAnswer,
  type FormColumn,
  answerGroups,
  answerText,
  columnText,
  formColumns,
  itemsOf,
  sentColumn,
  sentDefinition,
  submissionText,
  submissionsCsv
} from './FormAnswers.js'
import {formState} from './FormConditions.js'
import type {FormDefinition, FormInputData} from './FormDefinition.js'
import {formDefinition, inputsOf} from './FormDefinition.js'
import {formOf} from './FormField.js'
import {fillForm} from './FormShare.js'
import css from './FormSubmissions.module.css'

const styles = styler(css)

type StatusFilter = NonNullable<SubmissionQuery['status']>

const statusFilters: Record<StatusFilter, string> = {
  open: 'New and read',
  new: 'New',
  read: 'Read',
  archived: 'Archived',
  all: 'All'
}

/** What editors filter the submissions of a form by */
interface SubmissionFilter {
  search: string
  range: DateRange | null
  status: StatusFilter
  choice: {key: string; value: string} | null
  locale: string | null
}

const filterAtom = dispense((entryId: string) =>
  atom<SubmissionFilter>({
    search: '',
    range: null,
    status: 'open',
    choice: null,
    locale: null
  })
)

/** A linked submission, which can be outside the pages shown */
const linkedAtom = dispense((entryId: string, id: string) =>
  atomWithPending(submissionAtom(entryId, id))
)

const notLinked = atom([false, null] as const)

/** How many pages of submissions are shown, more load on scrolling */
const shownPages = dispense((entryId: string) => atom(1))

const pageSize = 50

const pages = new Map<string, Atom<Promise<SubmissionPage>>>()

/**
 * A page of submissions, by the entry, the query, the page and the version.
 * Each search and change asks for new ones, only the latest are kept.
 */
function pageAtom(key: string): Atom<Promise<SubmissionPage>> {
  const known = pages.get(key)
  if (known) return known
  const result = atom(async get => {
    const {entryId, query, page} = JSON.parse(key) as {
      entryId: string
      query: SubmissionQuery
      page: number
    }
    return get(clientAtom).submissions(entryId, {
      ...query,
      offset: page * pageSize,
      limit: pageSize
    })
  })
  pages.set(key, result)
  if (pages.size > 100) pages.delete(pages.keys().next().value!)
  return result
}

/** The submissions shown in the table, the pages loaded so far */
const submissionsAtom = dispense((entryId: string) =>
  atomWithPending(
    atom(async get => {
      const changes = get(submissionsVersion(entryId))
      const query = submissionQuery(get(filterAtom(entryId)))
      const pages = await Promise.all(
        Array.from({length: get(shownPages(entryId))}, (_, page) =>
          get(pageAtom(JSON.stringify({entryId, query, page, changes})))
        )
      )
      return {
        submissions: pages.flatMap(page => page.submissions),
        total: pages.at(-1)?.total ?? 0
      }
    })
  )
)

function submissionQuery(filter: SubmissionFilter): SubmissionQuery {
  const {range} = filter
  return {
    status: filter.status,
    search: filter.search.trim() || undefined,
    choice: filter.choice ?? undefined,
    locale: filter.locale ?? undefined,
    // From the start of the first day to the start of the day after the last
    from: range ? startOfDay(range.start) : undefined,
    until: range ? startOfDay(range.end, 1) : undefined
  }
}

function startOfDay(day: string, add = 0): number {
  const [year, month, date] = day.split('-').map(Number)
  return Math.floor(new Date(year, month - 1, date + add).getTime() / 1000)
}

const columns = 4
const noLocales: ReadonlyArray<string> = []

/** The answers visitors sent to the form of the entry */
export function FormSubmissionsView() {
  const entry = useEntry()
  const config = useAtomValueRaw(configAtom)
  const i18n = useMemo(() => {
    const workspace = entry && config.workspaces[entry.workspace]
    const root = workspace && getWorkspace(workspace).roots[entry.root]
    return root ? getRoot(root).i18n : undefined
  }, [config, entry])
  const definition = useFormDefinition(i18n)
  const locales = i18n?.locales ?? noLocales
  if (!entry || !definition) return null
  return (
    <FormSubmissions
      entryId={entry.id}
      definition={definition}
      locales={locales}
    />
  )
}

/** The form as it is now in the editor, which the table shows columns for */
function useFormDefinition(
  i18n: RootI18n | undefined
): FormDefinition | undefined {
  const editor = useEditor()
  const locale = useLocale()
  const versions = useOtherVersions()
  const form = formOf(editor.type)
  const key = form?.key
  const rows = useAtomValueRaw(
    useMemo(() => editor.node.field(key ?? '_form'), [editor, key])
  )
  const field = form?.field
  return useMemo(() => {
    if (!key || !field) return undefined
    const {inputs, shared} = Field.options(field)
    // Columns show texts this language has not translated yet like the site
    const others =
      shared && locale
        ? Root.fallbackOrder(i18n, locale, versions).map(
            version => (version.data as Record<string, unknown>)[key]
          )
        : []
    return formDefinition(inputs, fillForm(inputs, rows, others))
  }, [field, i18n, key, locale, rows, versions])
}

interface FormSubmissionsProps {
  entryId: string
  definition: FormDefinition
  /** The languages of the root of the form, none when it is not translated */
  locales: ReadonlyArray<string>
}

function FormSubmissions({entryId, definition, locales}: FormSubmissionsProps) {
  const [pending, page] = useAtomValueRawSync(submissionsAtom(entryId))
  const submissions = page?.submissions ?? []
  const total = page?.total ?? 0
  const filter = useAtomValueRaw(filterAtom(entryId))
  const setFilter = useSetAtom(filterAtom(entryId))
  const setPages = useSetAtom(shownPages(entryId))
  const store = useStore()
  const [search, setSearch] = useState(filter.search)
  const searching = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inputs = useMemo(() => formColumns(definition), [definition])
  // The first choice of the form filters the submissions, eg. a service
  const choice = inputs.find(
    (input): input is FormInputData =>
      input.control !== 'section' && Boolean(input.choices?.length)
  )
  // The open submission is read from the sheet, opening it can remount this
  // view as the sidebar appears
  const openId = useOpenBlockSheetId()
  const selected = openId?.startsWith(sheetPrefix)
    ? openId.slice(sheetPrefix.length)
    : undefined
  // The last one opened stays mounted while its sheet animates out
  const [shown, setShown] = useState<string>()
  if (selected && selected !== shown) setShown(selected)
  const openSheet = useOpenBlockSheet()
  const closeSheet = useCloseBlockSheet()
  const requested = useOptionalDashboardContext()?.page.submission
  const setRequested = useSetAtom(openSubmissionAtom)
  const [, linked] = useAtomValueRawSync(
    requested ? linkedAtom(entryId, requested) : notLinked
  )
  // The url follows the open sheet, and a link opens the sheet it names
  const last = useRef(selected)
  useEffect(() => {
    const previous = last.current
    last.current = selected
    if (selected !== previous) setRequested(selected)
    else if (requested && requested !== selected) openSheet(sheetId(requested))
  }, [selected, requested, openSheet, setRequested])
  const [exporting, setExporting] = useState(false)
  const visible = inputs.slice(0, columns)
  const title = visible.slice(0, 1)
  const rest = visible.slice(1)
  const current = [...submissions, linked].find(
    submission => submission && submission.id === (selected ?? shown)
  )
  const filtered =
    filter.search !== '' ||
    filter.range !== null ||
    filter.choice !== null ||
    filter.locale !== null ||
    (filter.status !== 'open' && filter.status !== 'all')

  function update(change: Partial<SubmissionFilter>) {
    setPages(1)
    setFilter(current => ({...current, ...change}))
  }

  // Searches once typing pauses, not for every key
  function changeSearch(value: string) {
    setSearch(value)
    clearTimeout(searching.current)
    searching.current = setTimeout(() => update({search: value}), 300)
  }

  function open(id: string) {
    openSheet(sheetId(id))
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const client = store.get(clientAtom)
      const query = submissionQuery(filter)
      const all = Array<Submission>()
      while (true) {
        const {submissions} = await client.submissions(entryId, {
          ...query,
          offset: all.length,
          limit: 500
        })
        all.push(...submissions)
        if (submissions.length < 500) break
      }
      download(definition, all)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.FormSubmissions()}>
      <div className={styles.FormSubmissions.filters()}>
        <SearchField
          aria-label="Search answers"
          placeholder="Search answers..."
          className={styles.FormSubmissions.search()}
          value={search}
          onValueChange={changeSearch}
        />
        <DateRangePicker
          aria-label="Received between"
          className={styles.FormSubmissions.filter()}
          value={filter.range}
          onValueChange={range => update({range})}
        />
        {choice && (
          <Select
            aria-label={choice.label}
            className={styles.FormSubmissions.filter()}
            placeholder={choice.label}
            clearable
            value={
              filter.choice?.key === choice.key ? filter.choice.value : null
            }
            onValueChange={value =>
              update({
                choice:
                  value === null
                    ? null
                    : {key: choice.key, value: String(value)}
              })
            }
          >
            {choice.choices!.map(option => (
              <SelectItem key={option.id} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        )}
        {locales.length > 1 && (
          <Select
            aria-label="Language"
            className={styles.FormSubmissions.filter()}
            placeholder="Language"
            clearable
            value={filter.locale}
            onValueChange={value =>
              update({locale: value === null ? null : String(value)})
            }
          >
            {locales.map(locale => (
              <SelectItem key={locale} value={locale}>
                {locale.toUpperCase()}
              </SelectItem>
            ))}
          </Select>
        )}
        <Select
          aria-label="Status"
          className={styles.FormSubmissions.filter()}
          value={filter.status}
          onValueChange={value =>
            value && update({status: value as StatusFilter})
          }
        >
          {entries(statusFilters).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </Select>
        <Button
          variant="outline"
          icon={IcRoundDownload}
          disabled={total === 0 || exporting}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </div>
      <Table
        aria-label="Submissions"
        items={submissions}
        loading={pending && submissions.length === 0}
        onLoadMore={
          submissions.length < total && !pending
            ? () => setPages(pages => pages + 1)
            : undefined
        }
        // The status follows the answer that names a submission, so it stays
        // in view next to the preview, later answers give up width first
        columns={[
          ...title.map(input => ({
            id: input.id,
            header: input.label,
            width: '2fr' as const,
            minWidth: 140
          })),
          {id: 'status', header: 'Status', width: 100},
          ...rest.map(input => ({
            id: input.id,
            header: input.label,
            width: '1fr' as const,
            minWidth: 80,
            collapsible: true
          })),
          {id: 'received', header: 'Received', width: 160}
        ]}
        dependencies={[visible, selected]}
        onRowAction={key => open(String(key))}
        renderEmptyState={() => (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IcOutlineTableRows />
              </EmptyMedia>
              <EmptyTitle>No submissions</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? 'None match these filters.'
                  : 'Answers visitors send show up here.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      >
        {submission => (
          <TableRow
            id={submission.id}
            textValue={rowTitle(definition, submission)}
            highlighted={submission.id === selected}
          >
            {[
              ...title.map(column => (
                <TableCell key={column.id}>
                  <AnswerText column={column} submission={submission} />
                </TableCell>
              )),
              <TableCell key="status">
                <SubmissionBadge status={submission.status} />
              </TableCell>,
              ...rest.map(column => (
                <TableCell key={column.id}>
                  <AnswerText column={column} submission={submission} />
                </TableCell>
              )),
              <TableCell key="received">
                {formatDate(submission.createdAt)}
              </TableCell>
            ]}
          </TableRow>
        )}
      </Table>
      {current && (
        <BlockSheet id={sheetId(current.id)}>
          <SubmissionSheet
            entryId={entryId}
            submission={current}
            title={rowTitle(definition, current)}
            onClose={closeSheet}
          />
        </BlockSheet>
      )}
    </div>
  )
}
const sheetPrefix = 'submission:'

function sheetId(id: string) {
  return sheetPrefix + id
}

interface AnswerTextProps {
  column: FormColumn
  submission: Submission
}

/** An answer in the table, or why there is none */
function AnswerText({column, submission}: AnswerTextProps) {
  const text = submissionText(column, submission)
  if (text) return <>{text}</>
  const own = sentColumn(column, submission)
  const hidden =
    own !== undefined &&
    formState(
      sentDefinition(submission),
      submission.values,
      submission.locale
    ).hidden.has(own.id)
  if (own && !hidden) return null
  return (
    <Text color="muted" className={styles.FormSubmissions.missing()}>
      {hidden ? 'not shown' : 'not asked'}
    </Text>
  )
}

interface SubmissionBadgeProps {
  status: SubmissionStatus
}

function SubmissionBadge({status}: SubmissionBadgeProps) {
  if (status === 'archived')
    return (
      <Badge size="sm" icon={IcRoundArchive}>
        archived
      </Badge>
    )
  return (
    <Badge size="sm" color={status === 'new' ? 'primary' : undefined}>
      {status}
    </Badge>
  )
}

interface SubmissionSheetProps {
  entryId: string
  submission: Submission
  title: string
  /** Closes the sheet, from its close button and on Escape */
  onClose: () => void
}

/** One submission with the form as it was sent */
function SubmissionSheet({
  entryId,
  submission,
  title,
  onClose
}: SubmissionSheetProps) {
  const store = useStore()
  const reload = useSetAtom(submissionsVersion(entryId))
  const definition = submission.definition as FormDefinition
  const groups = answerGroups(definition, submission.values, submission.locale)

  async function update(status: SubmissionStatus) {
    await store.get(clientAtom).updateSubmission(entryId, submission.id, status)
    reload(count => count + 1)
  }

  async function remove() {
    await store.get(clientAtom).deleteSubmission(entryId, submission.id)
    reload(count => count + 1)
  }

  return (
    <SheetContent onClose={onClose}>
      <SheetHeader>
        <SubmissionBadge status={submission.status} />
        <SheetTitle>{title}</SheetTitle>
        <SheetClose aria-label="Close submission" />
      </SheetHeader>
      <SheetBody>
        {groups.map((group, index) => (
          <SheetSection key={index} title={group.title}>
            {/* Questions are often long, the answer reads best below it */}
            <DataList orientation="vertical">
              {group.answers
                .filter(answer => !isFileAnswer(answer))
                .map(({input, text, state}) => (
                  <DataListItem key={input.id} full>
                    <DataListLabel>{input.label}</DataListLabel>
                    <DataListValue>
                      {state === 'answered' ? (
                        text
                      ) : (
                        <Text
                          color="muted"
                          className={styles.FormSubmissions.missing()}
                        >
                          {state === 'hidden' ? 'not shown' : 'left empty'}
                        </Text>
                      )}
                    </DataListValue>
                  </DataListItem>
                ))}
            </DataList>
            {/* Files show below the answers of their section, as cards */}
            {group.answers.filter(isFileAnswer).map(({input, value}) => (
              <SubmissionFiles
                key={input.id}
                entryId={entryId}
                input={input.label}
                files={value}
              />
            ))}
          </SheetSection>
        ))}
        <SheetSection title="Sent">
          <DataList>
            <DataListItem>
              <DataListLabel>Received</DataListLabel>
              <DataListValue>{formatDate(submission.createdAt)}</DataListValue>
            </DataListItem>
            {submission.page && (
              <DataListItem>
                <DataListLabel>Page</DataListLabel>
                <DataListValue>{submission.page}</DataListValue>
              </DataListItem>
            )}
            {submission.locale && (
              <DataListItem>
                <DataListLabel>Language</DataListLabel>
                <DataListValue>{submission.locale}</DataListValue>
              </DataListItem>
            )}
            {submission.notified && submission.notified.length > 0 && (
              <DataListItem>
                <DataListLabel>Notified</DataListLabel>
                <DataListValue>{submission.notified.join(', ')}</DataListValue>
              </DataListItem>
            )}
          </DataList>
        </SheetSection>
      </SheetBody>
      <SheetFooter>
        {submission.status === 'new' && (
          <Button
            variant="ghost"
            size="sm"
            icon={IcRoundCheck}
            onClick={() => update('read')}
          >
            Mark as read
          </Button>
        )}
        {submission.status === 'archived' ? (
          <Button
            variant="ghost"
            size="sm"
            icon={IcRoundUnarchive}
            onClick={() => update('read')}
          >
            Restore
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={IcRoundArchive}
            onClick={() => update('archived')}
          >
            Archive
          </Button>
        )}
        <Dialog>
          <DialogTrigger
            variant="ghost"
            size="sm"
            color="destructive"
            icon={IcRoundDelete}
          >
            Delete
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this submission?</DialogTitle>
              <DialogDescription>
                The answers and files of {title} are removed for good.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose variant="outline" color="secondary">
                Cancel
              </DialogClose>
              <DialogClose
                color="destructive"
                icon={IcRoundDelete}
                onClick={remove}
              >
                Delete
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetFooter>
    </SheetContent>
  )
}

function isFileAnswer(answer: FormAnswer): boolean {
  return answer.state === 'answered' && answer.input.attributes.type === 'file'
}

interface SubmissionFilesProps {
  entryId: string
  /** The label of the file input */
  input: string
  files: unknown
}

/** The files a visitor sent, downloaded with the rights of the editor */
function SubmissionFiles({entryId, input, files}: SubmissionFilesProps) {
  const store = useStore()
  const list = Array.isArray(files) ? (files as Array<FormFileRef>) : []

  async function download(file: FormFileRef) {
    const blob = await store.get(clientAtom).submissionFile(entryId, file.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.FormSubmissions.files()}>
      {list.map(file => (
        <div key={file.id} className={styles.FormSubmissions.file()}>
          <IcRoundUploadFile className={styles.FormSubmissions.file.icon()} />
          <div className={styles.FormSubmissions.file.label()}>
            <Text weight="medium" truncate>
              {file.name}
            </Text>
            <Text size="sm" color="muted">
              {input} · {formatSize(file.size)}
            </Text>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            icon={IcRoundDownload}
            aria-label={`Download ${file.name}`}
            onClick={() => download(file)}
          />
        </div>
      ))}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The first answer of a submission names it, eg. the name of the visitor, in
 * the form it was sent with
 */
function rowTitle(definition: FormDefinition, submission: Submission): string {
  const sent = sentDefinition(submission)
  for (const column of formColumns(sent.length > 0 ? sent : definition)) {
    // The first item of a repeatable section names it, eg. its first person
    const values =
      column.control === 'section'
        ? (itemsOf(submission.values[column.key!])[0] ?? {})
        : submission.values
    const inputs =
      column.control === 'section' ? inputsOf(column.inputs) : [column]
    for (const input of inputs) {
      const text = answerText(input, values[input.key])
      if (text) return text
    }
  }
  return 'Submission'
}

function localDay(seconds: number): string {
  const date = new Date(seconds * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

function formatDate(seconds: number): string {
  return dateFormat.format(new Date(seconds * 1000))
}

function download(definition: FormDefinition, submissions: Array<Submission>) {
  const csv = submissionsCsv(definition, submissions)
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}))
  const link = document.createElement('a')
  link.href = url
  link.download = `submissions-${localDay(Date.now() / 1000)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
