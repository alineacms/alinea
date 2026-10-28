import {
  Button,
  Field,
  Text,
  Timestamp,
  ToggleGroup,
  ToggleGroupItem
} from '#/components.js'
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
        {merge.date !== undefined && (
          <Text as="p" color="muted">
            Saved <Timestamp date={merge.date} format="relative" />
          </Text>
        )}
        {merge.merged.length > 0 && (
          <Text as="p">Merged automatically: {merge.merged.join(', ')}</Text>
        )}
        <Text as="p">You both changed these fields, choose what to keep.</Text>
        <ul className={styles.EntryMergeModal.fields()}>
          {merge.fields.map(field => (
            <EntryMergeRow
              key={field.key}
              field={field}
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
  choice: MergeChoice
  onChoice(choice: MergeChoice): void
}

// What a choice keeps of a nested field, a list or rich text
const nestedChoice = {
  merge: 'Both changes, yours where you changed the same part',
  yours: 'Your version of the whole field',
  theirs: 'Their version of the whole field'
}

function EntryMergeRow({field, choice, onChoice}: EntryMergeRowProps) {
  const value = choice === 'theirs' ? field.theirs : field.yours
  const description = !field.simple
    ? nestedChoice[choice]
    : isEmpty(value)
      ? 'Empty'
      : String(value)
  return (
    <li className={styles.EntryMergeModal.field()}>
      <Field label={field.label} description={description}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={`Keep for ${field.label}`}
          value={choice}
          onValueChange={next => {
            if (next) onChoice(next as MergeChoice)
          }}
        >
          {!field.simple && (
            <ToggleGroupItem value="merge">Merge</ToggleGroupItem>
          )}
          <ToggleGroupItem value="yours">Yours</ToggleGroupItem>
          <ToggleGroupItem value="theirs">Theirs</ToggleGroupItem>
        </ToggleGroup>
      </Field>
    </li>
  )
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === ''
}
