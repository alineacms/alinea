import {
  Badge,
  Button,
  Heading,
  RadioGroup,
  RadioGroupItem,
  Text,
  Timestamp
} from '#/components.js'
import {entries, isRecord} from '#/core/util/Objects.js'
import styler from '@alinea/styler'
import {useState} from 'react'
import type {
  EntryMerge,
  EntryMergeField,
  MergeChoice
} from '../atoms/entryMerge.js'
import {equal} from '../atoms/ReactiveNode.js'
import {
  IcRoundArrowBack,
  IcRoundCheck,
  IcRoundChevronRight,
  IcRoundSave
} from '../icons.js'
import css from './EntryMergeModal.module.css'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface EntryMergeModalProps {
  merge?: EntryMerge
  /** The edits were published, rather than saved as a draft */
  publish?: boolean
  onApply(choices: Record<string, MergeChoice>): void
  onDiscard(): void
  onClose(): void
}

/** Choose per field which edits to keep when both editors changed it */
export function EntryMergeModal({
  merge,
  publish,
  onApply,
  onDiscard,
  onClose
}: EntryMergeModalProps) {
  return (
    <DashboardModal
      open={Boolean(merge)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      {merge && (
        <EntryMergeDialog
          merge={merge}
          publish={publish}
          onApply={onApply}
          onDiscard={onDiscard}
        />
      )}
    </DashboardModal>
  )
}

interface EntryMergeDialogProps {
  merge: EntryMerge
  publish?: boolean
  onApply(choices: Record<string, MergeChoice>): void
  onDiscard(): void
}

function EntryMergeDialog({
  merge,
  publish,
  onApply,
  onDiscard
}: EntryMergeDialogProps) {
  const [choices, setChoices] = useState(
    () =>
      Object.fromEntries(
        merge.fields.map(field => [field.key, field.simple ? 'yours' : 'merge'])
      ) as Record<string, MergeChoice>
  )
  const [reviewing, setReviewing] = useState<string>()
  const theirLabel = merge.name ? `${merge.name}'s` : 'Theirs'
  const detail = merge.fields.find(field => field.key === reviewing)
  const choose = (key: string) => (choice: MergeChoice) =>
    setChoices(current => ({...current, [key]: choice}))
  return (
    <DashboardModalDialog
      label={`${merge.name ?? 'Someone'} saved this page while you were editing`}
    >
      <DashboardModalContent>
        {detail ? (
          <EntryMergeDetail
            field={detail}
            theirLabel={theirLabel}
            choice={choices[detail.key]}
            onChoice={choose(detail.key)}
            onBack={() => setReviewing(undefined)}
          />
        ) : (
          <>
            {(merge.date !== undefined || merge.merged.length > 0) && (
              <Text as="p" size="sm" color="muted">
                {merge.date !== undefined && (
                  <>
                    Saved <Timestamp date={merge.date} format="relative" />
                  </>
                )}
                {merge.date !== undefined && merge.merged.length > 0 && ' · '}
                {merge.merged.length > 0 &&
                  `Merged automatically: ${merge.merged.join(', ')}`}
              </Text>
            )}
            <Text as="p">
              You both changed these fields, choose what to keep.
            </Text>
            <ul className={styles.EntryMergeModal.fields()}>
              {merge.fields.map(field => (
                <li key={field.key} className={styles.EntryMergeModal.field()}>
                  <div className={styles.EntryMergeModal.field.header()}>
                    <Text weight="medium">{field.label}</Text>
                    {!field.simple && (
                      <Button
                        variant="link"
                        size="sm"
                        icon={IcRoundChevronRight}
                        onClick={() => setReviewing(field.key)}
                      >
                        Review changes
                      </Button>
                    )}
                  </div>
                  <EntryMergeChoices
                    field={field}
                    theirLabel={theirLabel}
                    choice={choices[field.key]}
                    onChoice={choose(field.key)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </DashboardModalContent>
      <DashboardModalFooter>
        <Button variant="ghost" onClick={onDiscard}>
          Discard my changes
        </Button>
        <Button
          color="primary"
          icon={publish ? IcRoundCheck : IcRoundSave}
          onClick={() => onApply(choices)}
        >
          {publish ? 'Apply and publish' : 'Apply and save draft'}
        </Button>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}

interface EntryMergeChoicesProps {
  field: EntryMergeField
  theirLabel: string
  choice: MergeChoice
  onChoice(choice: MergeChoice): void
}

function EntryMergeChoices({
  field,
  theirLabel,
  choice,
  onChoice
}: EntryMergeChoicesProps) {
  const option = styles.EntryMergeModal.option()
  return (
    <RadioGroup
      aria-label={field.label}
      orientation="horizontal"
      value={choice}
      onValueChange={value => onChoice(value as MergeChoice)}
      className={styles.EntryMergeModal.choices()}
    >
      <RadioGroupItem
        value="yours"
        className={option}
        description={<EntryMergeValue value={field.yours} />}
      >
        Yours
      </RadioGroupItem>
      <RadioGroupItem
        value="theirs"
        className={option}
        description={<EntryMergeValue value={field.theirs} />}
      >
        {theirLabel}
      </RadioGroupItem>
      {!field.simple && (
        <RadioGroupItem value="merge" className={option}>
          Combine both
        </RadioGroupItem>
      )}
    </RadioGroup>
  )
}

interface EntryMergeDetailProps extends EntryMergeChoicesProps {
  onBack(): void
}

/** The rows or paragraphs each editor changed in a list or rich text */
function EntryMergeDetail({onBack, ...props}: EntryMergeDetailProps) {
  const {field, theirLabel} = props
  return (
    <div className={styles.EntryMergeModal.detail()}>
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={IcRoundArrowBack}
          onClick={onBack}
        >
          All fields
        </Button>
      </div>
      <Heading as="h3" size="sm">
        {field.label}
      </Heading>
      <div className={styles.EntryMergeModal.sides()}>
        <EntryMergeSide title="Yours" base={field.base} value={field.yours} />
        <EntryMergeSide
          title={theirLabel}
          base={field.base}
          value={field.theirs}
        />
      </div>
      <EntryMergeChoices {...props} />
    </div>
  )
}

interface EntryMergeSideProps {
  title: string
  base: unknown
  value: unknown
}

const changeLabel = {added: 'Added', changed: 'Changed', removed: 'Removed'}

function EntryMergeSide({title, base, value}: EntryMergeSideProps) {
  return (
    <section aria-label={title} className={styles.EntryMergeModal.side()}>
      <Text weight="medium">{title}</Text>
      <ul className={styles.EntryMergeModal.parts()}>
        {changes(base, value).map(part => (
          <li
            key={`${part.state}-${part.id}`}
            className={styles.EntryMergeModal.part({[part.state]: true})}
          >
            <span className={styles.EntryMergeModal.part.text()}>
              {part.text || 'Empty'}
            </span>
            {part.state !== 'same' && (
              <Badge size="sm">{changeLabel[part.state]}</Badge>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface EntryMergeValueProps {
  value: unknown
}

function EntryMergeValue({value}: EntryMergeValueProps) {
  const text = summary(value)
  return (
    <span className={styles.EntryMergeModal.value({empty: !text})}>
      {text || 'Empty'}
    </span>
  )
}

interface Part {
  id: string
  text: string
  value: unknown
}

interface Change extends Part {
  state: 'same' | 'added' | 'changed' | 'removed'
}

/** The rows, paragraphs or properties of a value */
function parts(value: unknown): Array<Part> {
  if (Array.isArray(value))
    return value.map((item, index) => ({
      id:
        isRecord(item) && typeof item._id === 'string' ? item._id : `${index}`,
      text: summary(item),
      value: item
    }))
  if (isRecord(value))
    return entries(value)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, item]) => ({id: key, text: summary(item), value: item}))
  return [{id: '', text: summary(value), value}]
}

/** The parts of a value compared to the value it was edited from */
function changes(base: unknown, value: unknown): Array<Change> {
  const before = parts(base)
  const after = parts(value)
  const byId = new Map(before.map(part => [part.id, part]))
  const ids = new Set(after.map(part => part.id))
  return [
    ...after.map((part): Change => {
      const previous = byId.get(part.id)
      if (!previous) return {...part, state: 'added'}
      const same = equal(previous.value, part.value)
      return {...part, state: same ? 'same' : 'changed'}
    }),
    ...before
      .filter(part => !ids.has(part.id))
      .map((part): Change => ({...part, state: 'removed'}))
  ]
}

/** A line of text for a value: rows are counted, rich text shows its text */
function summary(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) {
    const rows = value.every(item => isRecord(item) && '_id' in item)
    if (rows && value.length > 0)
      return value.length === 1 ? '1 item' : `${value.length} items`
    return plainText(value)
  }
  const text = entries(value).find(
    ([key, field]) => !key.startsWith('_') && typeof field === 'string' && field
  )
  return plainText(value) || (text?.[1] as string | undefined) || ''
}

function plainText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(plainText).join(' ').trim()
  if (!isRecord(value)) return ''
  if (typeof value.text === 'string') return value.text
  return Array.isArray(value.content) ? plainText(value.content) : ''
}
