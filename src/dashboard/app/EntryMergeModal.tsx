import {
  Button,
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
import {IcRoundCheck, IcRoundSave} from '../icons.js'
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
  return (
    <DashboardModalDialog
      label={`${merge.name ?? 'Someone'} saved this page while you were editing`}
    >
      <DashboardModalContent>
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
        <Text as="p">You both changed these fields, choose what to keep.</Text>
        <ul className={styles.EntryMergeModal.fields()}>
          {merge.fields.map(field => (
            <EntryMergeRow
              key={field.key}
              field={field}
              theirLabel={merge.name ? `${merge.name}'s` : 'Theirs'}
              choice={choices[field.key]}
              onChoice={choice =>
                setChoices(current => ({...current, [field.key]: choice}))
              }
            />
          ))}
        </ul>
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

interface EntryMergeRowProps {
  field: EntryMergeField
  theirLabel: string
  choice: MergeChoice
  onChoice(choice: MergeChoice): void
}

function EntryMergeRow({
  field,
  theirLabel,
  choice,
  onChoice
}: EntryMergeRowProps) {
  const option = styles.EntryMergeModal.option()
  return (
    <li className={styles.EntryMergeModal.field()}>
      <RadioGroup
        label={field.label}
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
          <RadioGroupItem
            value="merge"
            className={option}
            description={
              <span className={styles.EntryMergeModal.value()}>
                Yours win on overlap
              </span>
            }
          >
            Combine both
          </RadioGroupItem>
        )}
      </RadioGroup>
    </li>
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
