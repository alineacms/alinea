import {
  Badge,
  Button,
  Heading,
  RadioGroup,
  RadioGroupItem,
  Text,
  Timestamp
} from '#/components.js'
import {Field} from '#/core/Field.js'
import {ListField, ListFieldBase} from '#/core/field/ListField.js'
import {RecordField} from '#/core/field/RecordField.js'
import {RichTextField} from '#/core/field/RichTextField.js'
import {Type} from '#/core/Type.js'
import {entries, isEmptyValue, isRecord} from '#/core/util/Objects.js'
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
import {
  CompactField,
  type CompactFieldContext,
  CompactRecordFields
} from './CompactField.js'
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
  const context = {locale: merge.locale, links: merge.links}
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
            context={context}
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
                    context={context}
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
  context: CompactFieldContext
  theirLabel: string
  choice: MergeChoice
  onChoice(choice: MergeChoice): void
}

function EntryMergeChoices({
  field,
  context,
  theirLabel,
  choice,
  onChoice
}: EntryMergeChoicesProps) {
  return (
    <RadioGroup
      aria-label={field.label}
      variant="card"
      orientation="horizontal"
      value={choice}
      onValueChange={value => onChoice(value as MergeChoice)}
    >
      <RadioGroupItem
        value="yours"
        description={
          <EntryMergeValue
            field={field}
            context={context}
            value={field.yours}
          />
        }
      >
        Yours
      </RadioGroupItem>
      <RadioGroupItem
        value="theirs"
        description={
          <EntryMergeValue
            field={field}
            context={context}
            value={field.theirs}
          />
        }
      >
        {theirLabel}
      </RadioGroupItem>
      {!field.simple && (
        <RadioGroupItem value="merge">Combine both</RadioGroupItem>
      )}
    </RadioGroup>
  )
}

interface EntryMergeDetailProps extends EntryMergeChoicesProps {
  onBack(): void
}

/** The rows or paragraphs each editor changed in a list or rich text */
function EntryMergeDetail({onBack, ...props}: EntryMergeDetailProps) {
  const {field, context, theirLabel} = props
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
        <EntryMergeSide
          field={field}
          context={context}
          title="Yours"
          value={field.yours}
        />
        <EntryMergeSide
          field={field}
          context={context}
          title={theirLabel}
          value={field.theirs}
        />
      </div>
      <EntryMergeChoices {...props} />
    </div>
  )
}

interface EntryMergeSideProps {
  field: EntryMergeField
  context: CompactFieldContext
  title: string
  value: unknown
}

const changeLabel = {added: 'Added', changed: 'Changed', removed: 'Removed'}

function EntryMergeSide({field, context, title, value}: EntryMergeSideProps) {
  return (
    <section aria-label={title} className={styles.EntryMergeModal.side()}>
      <Text weight="medium">{title}</Text>
      <ul className={styles.EntryMergeModal.parts()}>
        {changes(field, field.base, value).map(part => (
          <li
            key={`${part.state}-${part.id}`}
            className={styles.EntryMergeModal.part({[part.state]: true})}
          >
            <span className={styles.EntryMergeModal.part.value()}>
              <EntryMergePart part={part} context={context} />
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
  field: EntryMergeField
  context: CompactFieldContext
  value: unknown
}

function EntryMergeValue({field, context, value}: EntryMergeValueProps) {
  if (isEmptyValue(value))
    return (
      <span className={styles.EntryMergeModal.value({empty: true})}>Empty</span>
    )
  return (
    <span className={styles.EntryMergeModal.value()}>
      {field.field ? (
        <CompactField field={field.field} value={value} {...context} />
      ) : (
        String(value)
      )}
    </span>
  )
}

/** A row, block or property of a field's value and the field rendering it */
interface Part {
  id: string
  value: unknown
  label?: string
  field?: Field
  /** Rendered with its row type's fields */
  row?: Type
}

interface Change extends Part {
  state: 'same' | 'added' | 'changed' | 'removed'
}

interface EntryMergePartProps {
  part: Part
  context: CompactFieldContext
}

function EntryMergePart({part, context}: EntryMergePartProps) {
  if (part.row && isRecord(part.value))
    return (
      <>
        <Badge size="sm">{Type.label(part.row)}</Badge>{' '}
        <CompactRecordFields
          fields={Type.fields(part.row)}
          value={part.value}
          {...context}
        />
      </>
    )
  return (
    <>
      {part.label && <Text weight="medium">{part.label}: </Text>}
      {part.field ? (
        <CompactField field={part.field} value={part.value} {...context} />
      ) : (
        String(part.value ?? '')
      )}
    </>
  )
}

/** The parts of a value as its field stores them */
function parts(field: Field | undefined, value: unknown): Array<Part> {
  if (field instanceof ListField && Array.isArray(value)) {
    const schema = Field.options(field).schema as Record<string, Type>
    return value.map((row, index) => ({
      id: rowId(row, index),
      value: row,
      row: isRecord(row) ? schema[row._type as string] : undefined
    }))
  }
  if (
    (field instanceof ListFieldBase || field instanceof RichTextField) &&
    Array.isArray(value)
  )
    return value.map((item, index) => ({
      id: rowId(item, index),
      value: [item],
      field
    }))
  if (field instanceof RecordField && isRecord(value)) {
    const fields = Type.fields(Field.options(field).fields as Type)
    return entries(fields)
      .filter(([, inner]) => !Field.options(inner).hidden)
      .map(([key, inner]) => ({
        id: key,
        value: value[key],
        label: Field.label(inner),
        field: inner
      }))
  }
  return [{id: '', value, field}]
}

function rowId(row: unknown, index: number) {
  return isRecord(row) && typeof row._id === 'string' ? row._id : `${index}`
}

/** The parts of a value compared to the value it was edited from */
function changes(
  field: EntryMergeField,
  base: unknown,
  value: unknown
): Array<Change> {
  const before = parts(field.field, base)
  const after = parts(field.field, value)
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
