import {
  Badge,
  Button,
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  type DateRange,
  DateRangePicker,
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
import type {Submission, SubmissionStatus} from '#/core/Connection.js'
import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {BlockSheet, useOpenBlockSheet} from '#/dashboard/app/BlockSheet.js'
import {clientAtom} from '#/dashboard/atoms/core.js'
import {atomWithPending, dispense} from '#/dashboard/atoms/utils.js'
import {useEditor, useEntry} from '#/dashboard/hooks.js'
import {
  IcOutlineTableRows,
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundDownload,
  IcRoundUnarchive
} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {
  atom,
  useAtomValueRaw,
  useAtomValueRawSync,
  useSetAtom,
  useStore
} from 'jotai'
import {useMemo, useState} from 'react'
import {
  answerGroups,
  answerText,
  formInputs,
  matchesSearch,
  submissionsCsv
} from './FormAnswers.js'
import {formState} from './FormConditions.js'
import type {FormDefinition, FormInputData} from './FormDefinition.js'
import {formDefinition} from './FormDefinition.js'
import {FormField} from './FormField.js'
import css from './FormSubmissions.module.css'

const styles = styler(css)

/** Bumped after a change, so the submissions of the entry load again */
const version = dispense((entryId: string) => atom(0))

const submissionsAtom = dispense((entryId: string) =>
  atomWithPending(
    atom(async get => {
      get(version(entryId))
      return get(clientAtom).submissions(entryId)
    })
  )
)

type StatusFilter = 'open' | SubmissionStatus | 'all'

const statusFilters: Record<StatusFilter, string> = {
  open: 'New and read',
  new: 'New',
  read: 'Read',
  archived: 'Archived',
  all: 'All'
}

const columns = 4

/** The answers visitors sent to the form of the entry */
export function FormSubmissionsView() {
  const entry = useEntry()
  const definition = useFormDefinition()
  if (!entry || !definition) return null
  return <FormSubmissions entryId={entry.id} definition={definition} />
}

/** The form as it is now in the editor, which the table shows columns for */
function useFormDefinition(): FormDefinition | undefined {
  const editor = useEditor()
  const [key, field] =
    entries(Type.fields(editor.type)).find(
      ([, field]) => field instanceof FormField
    ) ?? []
  const rows = useAtomValueRaw(
    useMemo(() => editor.node.field(key ?? '_form'), [editor, key])
  )
  return useMemo(
    () =>
      field instanceof FormField
        ? formDefinition(Field.options(field).inputs, rows)
        : undefined,
    [field, rows]
  )
}

interface FormSubmissionsProps {
  entryId: string
  definition: FormDefinition
}

function FormSubmissions({entryId, definition}: FormSubmissionsProps) {
  const [pending, submissions = []] = useAtomValueRawSync(
    submissionsAtom(entryId)
  )
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<DateRange | null>(null)
  const [status, setStatus] = useState<StatusFilter>('open')
  const inputs = useMemo(() => formInputs(definition), [definition])
  // The first choice of the form filters the submissions, eg. a service
  const choice = inputs.find(input => input.choices?.length)
  const [chosen, setChosen] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>()
  const openSheet = useOpenBlockSheet()
  const shown = useMemo(
    () =>
      submissions.filter(
        submission =>
          statusMatches(status, submission.status) &&
          inRange(range, submission.createdAt) &&
          (!choice ||
            !chosen ||
            [submission.values[choice.key]].flat().includes(chosen)) &&
          matchesSearch(definition, submission, search)
      ),
    [submissions, status, range, choice, chosen, definition, search]
  )
  const visible = inputs.slice(0, columns)
  const current = submissions.find(submission => submission.id === selected)

  function open(id: string) {
    setSelected(id)
    openSheet(sheetId(id))
  }

  return (
    <div className={styles.FormSubmissions()}>
      <div className={styles.FormSubmissions.filters()}>
        <SearchField
          aria-label="Search answers"
          placeholder="Search answers..."
          className={styles.FormSubmissions.search()}
          value={search}
          onValueChange={setSearch}
        />
        <DateRangePicker
          aria-label="Received between"
          className={styles.FormSubmissions.filter()}
          value={range}
          onValueChange={setRange}
        />
        {choice && (
          <Select
            aria-label={choice.label}
            className={styles.FormSubmissions.filter()}
            placeholder={choice.label}
            clearable
            value={chosen}
            onValueChange={value =>
              setChosen(value === null ? null : String(value))
            }
          >
            {choice.choices!.map(option => (
              <SelectItem key={option.id} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        )}
        <Select
          aria-label="Status"
          className={styles.FormSubmissions.filter()}
          value={status}
          onValueChange={value => value && setStatus(value as StatusFilter)}
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
          disabled={shown.length === 0}
          onClick={() => download(definition, shown)}
        >
          Export CSV
        </Button>
      </div>
      <Table
        aria-label="Submissions"
        items={shown}
        loading={pending && submissions.length === 0}
        columns={[
          ...visible.map((input, index) => ({
            id: input.id,
            header: input.label,
            width: index === 0 ? ('2fr' as const) : ('1fr' as const),
            minWidth: 120
          })),
          {id: 'received', header: 'Received', width: 170},
          {id: 'status', header: 'Status', width: 110}
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
                {submissions.length === 0
                  ? 'Answers visitors send show up here.'
                  : 'None match these filters.'}
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
              ...visible.map(input => (
                <TableCell key={input.id}>
                  <AnswerText input={input} submission={submission} />
                </TableCell>
              )),
              <TableCell key="received">
                {formatDate(submission.createdAt)}
              </TableCell>,
              <TableCell key="status">
                <SubmissionBadge status={submission.status} />
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
          />
        </BlockSheet>
      )}
    </div>
  )
}

function sheetId(id: string) {
  return `submission:${id}`
}

interface AnswerTextProps {
  input: FormInputData
  submission: Submission
}

/** An answer in the table, or why there is none */
function AnswerText({input, submission}: AnswerTextProps) {
  const text = answerText(input, submission.values[input.key])
  if (text) return <>{text}</>
  const sent = submission.definition as FormDefinition
  const asked = formInputs(sent).some(other => other.id === input.id)
  const hidden =
    asked && formState(sent, submission.values).hidden.has(input.id)
  if (asked && !hidden) return null
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
}

/** One submission with the form as it was sent */
function SubmissionSheet({entryId, submission, title}: SubmissionSheetProps) {
  const store = useStore()
  const reload = useSetAtom(version(entryId))
  const definition = submission.definition as FormDefinition
  const groups = answerGroups(definition, submission.values)

  async function update(status: SubmissionStatus) {
    await store.get(clientAtom).updateSubmission(entryId, submission.id, status)
    reload(count => count + 1)
  }

  async function remove() {
    await store.get(clientAtom).deleteSubmission(entryId, submission.id)
    reload(count => count + 1)
  }

  return (
    <SheetContent>
      <SheetHeader>
        <SubmissionBadge status={submission.status} />
        <SheetTitle>{title}</SheetTitle>
        <SheetClose aria-label="Close submission" />
      </SheetHeader>
      <SheetBody>
        {groups.map((group, index) => (
          <SheetSection key={index} title={group.title}>
            <DataList>
              {group.answers.map(({input, text, state}) => (
                <DataListItem key={input.id}>
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
          </SheetSection>
        ))}
        <SheetSection title="Sent">
          <DataList>
            <DataListItem>
              <DataListLabel>Received</DataListLabel>
              <DataListValue>{formatDate(submission.createdAt)}</DataListValue>
            </DataListItem>
            {submission.locale && (
              <DataListItem>
                <DataListLabel>Language</DataListLabel>
                <DataListValue>{submission.locale}</DataListValue>
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
        <Button
          variant="ghost"
          size="sm"
          color="destructive"
          icon={IcRoundDelete}
          onClick={remove}
        >
          Delete
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

/** The first answer of a submission names it, eg. the name of the visitor */
function rowTitle(definition: FormDefinition, submission: Submission): string {
  for (const input of formInputs(definition)) {
    const text = answerText(input, submission.values[input.key])
    if (text) return text
  }
  return 'Submission'
}

function statusMatches(filter: StatusFilter, status: SubmissionStatus) {
  if (filter === 'all') return true
  if (filter === 'open') return status !== 'archived'
  return filter === status
}

function inRange(range: DateRange | null, createdAt: number) {
  if (!range) return true
  const day = localDay(createdAt)
  return day >= range.start && day <= range.end
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
