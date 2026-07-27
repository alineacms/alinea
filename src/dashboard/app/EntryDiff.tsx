import {
  Button,
  Icon,
  List,
  ListItem,
  Radio,
  RadioGroup,
  Surface,
  SurfaceHeader,
  TextField
} from '#/components.js'
import {isRecord} from '#/core/util/Objects.js'
import {styler} from '@alinea/styler'
import diffSequenceImport from 'diff-sequences'
import {atom, type PrimitiveAtom, useAtom} from 'jotai'
import {Fragment, type ReactNode, useMemo} from 'react'
import {
  IcOutlineList,
  IcRoundCheck,
  IcRoundLink,
  IcRoundTextFields,
  IcRoundWarning
} from '../icons.js'
import {Badge} from './Badge.js'
import css from './EntryDiff.module.css'

const styles = styler(css)

const scanSequence =
  typeof diffSequenceImport === 'function'
    ? diffSequenceImport
    : (
        diffSequenceImport as unknown as {
          default: typeof diffSequenceImport
        }
      ).default

export interface EntryDiffField {
  id: string
  label: string
  baseValue: unknown
  localValue: unknown
  serverValue?: unknown
  valueKind?: 'scalar' | 'link' | 'list' | 'object' | 'richText'
}

export type EntryDiffResolutionChoice = 'local' | 'server' | 'custom'

export interface EntryDiffResolution {
  choice: EntryDiffResolutionChoice
  value?: string
}

export interface EntryDiffResolutions {
  [fieldId: string]: EntryDiffResolution
}

export interface EntryDiffColumnLabels {
  left: ReactNode
  right: ReactNode
}

export interface EntryDiffProps {
  columnLabels?: EntryDiffColumnLabels
  fields: Array<EntryDiffField>
  mode?: 'compare' | 'resolve'
  resolutionsAtom?: PrimitiveAtom<EntryDiffResolutions>
  onApply?: (values: Record<string, unknown>) => void
}

interface EntryDiffFieldViewProps {
  field: EntryDiffField
  mode: 'compare' | 'resolve'
  resolution?: EntryDiffResolution
  onResolutionChange: (resolution: EntryDiffResolution) => void
}

interface EntryDiffValueProps {
  baseValue: unknown
  value: unknown
  valueKind?: EntryDiffField['valueKind']
  side?: 'before' | 'after' | 'combined'
}

interface EntryDiffChoiceProps {
  children: ReactNode
  interactive: boolean
  value: 'local' | 'server'
}

interface EntryDiffSegment {
  kind: 'equal' | 'insert' | 'delete'
  text: string
}

export interface EntryDiffRichTextBlock {
  id?: string
  label: string
  text: string
  type: string
}

export interface EntryDiffRichTextAlignment {
  after?: EntryDiffRichTextBlock
  afterIndex?: number
  before?: EntryDiffRichTextBlock
  beforeIndex?: number
  kind: 'same' | 'changed' | 'insert' | 'delete'
}

export function EntryDiff({
  columnLabels,
  fields,
  mode = 'compare',
  resolutionsAtom,
  onApply
}: EntryDiffProps) {
  const localResolutionsAtom = useMemo(() => atom<EntryDiffResolutions>({}), [])
  const [resolutions, setResolutions] = useAtom(
    resolutionsAtom ?? localResolutionsAtom
  )
  const changedFields = fields.filter(
    field => fieldChangeKind(field) !== 'same'
  )
  const conflicts = changedFields.filter(
    field => fieldChangeKind(field) === 'conflict'
  )
  const unresolvedCount = conflicts.filter(
    field => !resolutions[field.id]
  ).length
  const labels = columnLabels ?? {
    left: mode === 'resolve' ? 'Your version' : 'Previous',
    right: mode === 'resolve' ? 'Server version' : 'Current'
  }

  function updateResolution(fieldId: string, resolution: EntryDiffResolution) {
    setResolutions(current => ({...current, [fieldId]: resolution}))
  }

  function applyResolutions() {
    const values = Object.fromEntries(
      fields.map(field => [field.id, resolvedFieldValue(field, resolutions)])
    )
    onApply?.(values)
  }

  if (changedFields.length === 0) {
    return (
      <Surface className={styles.EntryDiff()}>
        <div className={styles.EntryDiff.empty()}>
          <Icon icon={IcRoundCheck} />
          <span>No differences found</span>
        </div>
      </Surface>
    )
  }

  return (
    <Surface className={styles.EntryDiff()}>
      <SurfaceHeader className={styles.EntryDiff.header()}>
        <div className={styles.EntryDiff.header.summary()}>
          {mode === 'resolve' && conflicts.length > 0 ? (
            <Icon icon={IcRoundWarning} />
          ) : (
            <Icon icon={IcRoundCheck} />
          )}
          <div className={styles.EntryDiff.header.text()}>
            <h2 className={styles.EntryDiff.header.title()}>
              {mode === 'resolve'
                ? `${conflicts.length} ${conflicts.length === 1 ? 'conflict' : 'conflicts'} to review`
                : `${changedFields.length} ${changedFields.length === 1 ? 'change' : 'changes'}`}
            </h2>
            <p className={styles.EntryDiff.header.description()}>
              {mode === 'resolve'
                ? 'Choose the value to keep for each conflicting field. Non-conflicting changes are merged automatically.'
                : 'Only fields that changed between these revisions are shown.'}
            </p>
          </div>
        </div>
        <div className={styles.EntryDiff.legend()} aria-label="Diff legend">
          <span className={styles.EntryDiff.legend.item()} data-kind="delete">
            Removed
          </span>
          <span className={styles.EntryDiff.legend.item()} data-kind="insert">
            Added
          </span>
        </div>
      </SurfaceHeader>

      <div className={styles.EntryDiff.columns()}>
        <span className={styles.EntryDiff.columns.heading()}>
          {labels.left}
        </span>
        <span className={styles.EntryDiff.columns.heading()}>
          {labels.right}
        </span>
      </div>

      <div className={styles.EntryDiff.fields()}>
        {changedFields.map(field => (
          <EntryDiffFieldView
            key={field.id}
            field={field}
            mode={mode}
            resolution={resolutions[field.id]}
            onResolutionChange={resolution =>
              updateResolution(field.id, resolution)
            }
          />
        ))}
      </div>

      {mode === 'resolve' && (
        <footer className={styles.EntryDiff.footer()}>
          <span className={styles.EntryDiff.footer.status()} aria-live="polite">
            {unresolvedCount === 0
              ? 'All conflicts resolved'
              : `${unresolvedCount} ${unresolvedCount === 1 ? 'decision' : 'decisions'} remaining`}
          </span>
          <Button
            appearance="solid"
            intent="primary"
            isDisabled={unresolvedCount > 0}
            onPress={applyResolutions}
          >
            Apply resolved version
          </Button>
        </footer>
      )}
    </Surface>
  )
}

function EntryDiffFieldView({
  field,
  mode,
  resolution,
  onResolutionChange
}: EntryDiffFieldViewProps) {
  const kind = fieldChangeKind(field)
  const isConflict = mode === 'resolve' && kind === 'conflict'
  const hasServerValue = Object.hasOwn(field, 'serverValue')
  const rightValue = hasServerValue ? field.serverValue : field.localValue
  const leftValue = field.localValue

  return (
    <article className={styles.EntryDiff.field()} data-kind={kind}>
      <div className={styles.EntryDiff.field.header()}>
        <h3 className={styles.EntryDiff.field.label()}>{field.label}</h3>
        {mode === 'resolve' && (
          <Badge
            className={styles.EntryDiff.field.status()}
            data-kind={kind}
            size="small"
          >
            {kind === 'conflict'
              ? resolution
                ? 'Resolved'
                : 'Needs decision'
              : kind === 'local'
                ? 'Your change'
                : 'Server change'}
          </Badge>
        )}
      </div>

      {isConflict ? (
        <RadioGroup
          aria-label={`Resolution for ${field.label}`}
          className={styles.EntryDiff.choices()}
          value={
            resolution?.choice === 'local' || resolution?.choice === 'server'
              ? resolution.choice
              : null
          }
          onChange={choice =>
            onResolutionChange({choice: choice as 'local' | 'server'})
          }
        >
          <EntryDiffChoice interactive value="local">
            <EntryDiffChoiceContent
              baseValue={field.baseValue}
              field={field}
              side={hasServerValue ? 'combined' : 'before'}
              value={leftValue}
            />
          </EntryDiffChoice>
          <EntryDiffChoice interactive value="server">
            <EntryDiffChoiceContent
              baseValue={field.baseValue}
              field={field}
              side={hasServerValue ? 'combined' : 'after'}
              value={rightValue}
            />
          </EntryDiffChoice>
        </RadioGroup>
      ) : (
        <div className={styles.EntryDiff.choices()}>
          <EntryDiffChoice interactive={false} value="local">
            <EntryDiffChoiceContent
              baseValue={field.baseValue}
              field={field}
              side={hasServerValue ? 'combined' : 'before'}
              value={leftValue}
            />
          </EntryDiffChoice>
          <EntryDiffChoice interactive={false} value="server">
            <EntryDiffChoiceContent
              baseValue={field.baseValue}
              field={field}
              side={hasServerValue ? 'combined' : 'after'}
              value={rightValue}
            />
          </EntryDiffChoice>
        </div>
      )}

      {isConflict &&
        typeof field.localValue === 'string' &&
        typeof field.serverValue === 'string' && (
          <div className={styles.EntryDiff.custom()}>
            <Button
              appearance={resolution?.choice === 'custom' ? 'active' : 'plain'}
              size="small"
              onPress={() =>
                onResolutionChange({
                  choice: 'custom',
                  value: resolution?.value ?? displayValue(field.localValue)
                })
              }
            >
              Write a merged value
            </Button>
            {resolution?.choice === 'custom' && (
              <TextField
                aria-label={`Merged value for ${field.label}`}
                multiline
                rows={3}
                value={resolution.value ?? ''}
                onChange={value =>
                  onResolutionChange({choice: 'custom', value})
                }
              />
            )}
          </div>
        )}
    </article>
  )
}

interface EntryDiffChoiceContentProps {
  baseValue: unknown
  field: EntryDiffField
  side: 'before' | 'after' | 'combined'
  value: unknown
}

function EntryDiffChoiceContent({
  baseValue,
  field,
  side,
  value
}: EntryDiffChoiceContentProps) {
  return (
    <EntryDiffValue
      baseValue={baseValue}
      value={value}
      valueKind={field.valueKind}
      side={side}
    />
  )
}

function EntryDiffChoice({children, interactive, value}: EntryDiffChoiceProps) {
  if (!interactive) {
    return <div className={styles.EntryDiff.choice()}>{children}</div>
  }
  return (
    <Radio className={styles.EntryDiff.choice()} value={value}>
      {({isSelected}) => (
        <>
          <span className={styles.EntryDiff.choice.control()}>
            <span
              aria-hidden="true"
              className={styles.EntryDiff.choice.control.box()}
            >
              {isSelected && <Icon icon={IcRoundCheck} />}
            </span>
            <span className={styles.EntryDiff.choice.control.label()}>
              Keep this
            </span>
          </span>
          <div className={styles.EntryDiff.choice.content()}>{children}</div>
        </>
      )}
    </Radio>
  )
}

function EntryDiffValue({
  baseValue,
  value,
  valueKind = 'scalar',
  side = 'combined'
}: EntryDiffValueProps) {
  if (valueKind === 'link') {
    return (
      <EntryDiffLinkValue baseValue={baseValue} value={value} side={side} />
    )
  }
  if (valueKind === 'list') {
    return (
      <EntryDiffListValue baseValue={baseValue} value={value} side={side} />
    )
  }
  if (valueKind === 'richText') {
    return (
      <EntryDiffRichTextValue baseValue={baseValue} value={value} side={side} />
    )
  }
  if (valueKind === 'object' || isRecord(baseValue) || isRecord(value)) {
    return (
      <EntryDiffObjectValue baseValue={baseValue} value={value} side={side} />
    )
  }
  if (Array.isArray(baseValue) || Array.isArray(value)) {
    return (
      <EntryDiffArrayValue baseValue={baseValue} value={value} side={side} />
    )
  }
  return <EntryDiffTextValue baseValue={baseValue} value={value} side={side} />
}

function EntryDiffObjectValue({
  baseValue,
  value,
  side = 'combined'
}: EntryDiffValueProps) {
  const before = isRecord(baseValue) ? baseValue : {}
  const after = isRecord(value) ? value : {}
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  )
  if (keys.length === 0)
    return <span className={styles.EntryDiff.value()}>Empty</span>
  return (
    <List className={styles.EntryDiff.object()}>
      {keys.map(key => (
        <ListItem className={styles.EntryDiff.object.item()} key={key}>
          <span className={styles.EntryDiff.object.item.label()}>
            {structuredKeyLabel(key)}
          </span>
          <div className={styles.EntryDiff.object.item.value()}>
            <EntryDiffValue
              baseValue={structuredValue(key, before[key])}
              value={structuredValue(key, after[key])}
              side={side}
            />
          </div>
        </ListItem>
      ))}
    </List>
  )
}

function EntryDiffArrayValue({
  baseValue,
  value,
  side = 'combined'
}: EntryDiffValueProps) {
  const before = Array.isArray(baseValue) ? baseValue : []
  const after = Array.isArray(value) ? value : []
  const length = Math.max(before.length, after.length)
  if (length === 0)
    return <span className={styles.EntryDiff.value()}>Empty</span>
  return (
    <List className={styles.EntryDiff.object()}>
      {Array.from({length}, (_, index) => (
        <ListItem className={styles.EntryDiff.object.item()} key={index}>
          <span className={styles.EntryDiff.object.item.label()}>
            Item {index + 1}
          </span>
          <div className={styles.EntryDiff.object.item.value()}>
            <EntryDiffValue
              baseValue={before[index]}
              value={after[index]}
              side={side}
            />
          </div>
        </ListItem>
      ))}
    </List>
  )
}

function EntryDiffTextValue({
  baseValue,
  value,
  side = 'combined'
}: EntryDiffValueProps) {
  const before = displayValue(baseValue)
  const after = displayValue(value)
  const segments = diffText(before, after).filter(segment => {
    if (side === 'before') return segment.kind !== 'insert'
    if (side === 'after') return segment.kind !== 'delete'
    return true
  })
  return (
    <span className={styles.EntryDiff.value()}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment.kind}-${index}`}>
          {segment.kind === 'equal' ? (
            segment.text
          ) : (
            <span
              className={styles.EntryDiff.value.segment()}
              data-kind={segment.kind}
            >
              {segment.text}
            </span>
          )}
        </Fragment>
      ))}
    </span>
  )
}

function EntryDiffLinkValue({
  baseValue,
  value,
  side = 'combined'
}: EntryDiffValueProps) {
  const title = linkTitle(value)
  const baseTitle = linkTitle(baseValue)
  const target = linkTarget(value)
  const baseTarget = linkTarget(baseValue)
  return (
    <List className={styles.EntryDiff.link()}>
      <ListItem
        className={styles.EntryDiff.link.item()}
        leading={
          <span className={styles.EntryDiff.link.icon()}>
            <Icon icon={IcRoundLink} />
          </span>
        }
      >
        <span className={styles.EntryDiff.link.content()}>
          <span className={styles.EntryDiff.link.title()}>
            <EntryDiffTextValue
              baseValue={baseTitle}
              value={title}
              side={side}
            />
          </span>
          <span className={styles.EntryDiff.link.target()}>
            <EntryDiffTextValue
              baseValue={baseTarget}
              value={target}
              side={side}
            />
          </span>
        </span>
      </ListItem>
    </List>
  )
}

function EntryDiffListValue({
  baseValue,
  value,
  side = 'combined'
}: EntryDiffValueProps) {
  const baseItems = Array.isArray(baseValue) ? baseValue : []
  const valueItems = Array.isArray(value) ? value : []
  const removedItems =
    side === 'combined'
      ? baseItems.filter(baseItem => {
          const baseId = recordString(baseItem, '_id')
          return !valueItems.some(
            valueItem => recordString(valueItem, '_id') === baseId
          )
        })
      : []
  const items = side === 'before' ? baseItems : [...valueItems, ...removedItems]
  return (
    <List className={styles.EntryDiff.list()}>
      {items.map((item, index) => {
        const id = recordString(item, '_id') ?? String(index)
        const isRemoved = side === 'combined' && index >= valueItems.length
        const comparisonItems = side === 'before' ? valueItems : baseItems
        const comparison =
          comparisonItems.find(
            candidate => recordString(candidate, '_id') === id
          ) ?? comparisonItems[index]
        const change = isRemoved
          ? 'delete'
          : comparison
            ? valuesEqual(item, comparison)
              ? 'same'
              : 'changed'
            : side === 'before'
              ? 'delete'
              : 'insert'
        return (
          <ListItem
            className={styles.EntryDiff.list.item()}
            data-kind={change}
            key={id}
            leading={
              <span className={styles.EntryDiff.list.item.icon()}>
                <Icon icon={IcOutlineList} />
              </span>
            }
            trailing={
              change !== 'same' ? (
                <Badge
                  className={styles.EntryDiff.list.item.status()}
                  data-kind={change}
                  size="small"
                >
                  {change === 'changed'
                    ? 'Edited'
                    : change === 'insert'
                      ? 'Added'
                      : 'Removed'}
                </Badge>
              ) : undefined
            }
          >
            <span className={styles.EntryDiff.list.item.content()}>
              <span className={styles.EntryDiff.list.item.title()}>
                {listItemTitle(item, index)}
              </span>
              <span className={styles.EntryDiff.list.item.meta()}>
                {listItemMeta(item)}
              </span>
            </span>
          </ListItem>
        )
      })}
    </List>
  )
}

function EntryDiffRichTextValue({
  baseValue,
  value,
  side = 'combined'
}: EntryDiffValueProps) {
  const alignment = alignRichTextBlocks(baseValue, value).filter(item => {
    if (side === 'before') return item.before !== undefined
    if (side === 'after') return item.after !== undefined
    return true
  })
  return (
    <List className={styles.EntryDiff.richText()}>
      {alignment.map(item => {
        const block =
          side === 'before' ? item.before : (item.after ?? item.before)
        if (!block) return null
        const textSide =
          side === 'combined' && item.kind === 'insert'
            ? 'after'
            : side === 'combined' && item.kind === 'delete'
              ? 'before'
              : side
        return (
          <ListItem
            className={styles.EntryDiff.richText.block()}
            data-kind={item.kind}
            key={`${item.beforeIndex ?? 'new'}-${item.afterIndex ?? 'removed'}`}
            leading={
              <span className={styles.EntryDiff.richText.block.icon()}>
                <Icon icon={IcRoundTextFields} />
              </span>
            }
            trailing={
              item.kind !== 'same' ? (
                <Badge
                  className={styles.EntryDiff.list.item.status()}
                  data-kind={item.kind}
                  size="small"
                >
                  {item.kind === 'changed'
                    ? 'Edited'
                    : item.kind === 'insert'
                      ? 'Added'
                      : 'Removed'}
                </Badge>
              ) : undefined
            }
          >
            <span className={styles.EntryDiff.richText.block.content()}>
              <span className={styles.EntryDiff.richText.block.label()}>
                {block.label}
              </span>
              <EntryDiffTextValue
                baseValue={item.before?.text ?? ''}
                value={item.after?.text ?? ''}
                side={textSide}
              />
            </span>
          </ListItem>
        )
      })}
    </List>
  )
}

export function alignRichTextBlocks(
  baseValue: unknown,
  value: unknown
): Array<EntryDiffRichTextAlignment> {
  const before = richTextBlocks(baseValue)
  const after = richTextBlocks(value)
  const result: Array<EntryDiffRichTextAlignment> = []
  let beforeIndex = 0
  let afterIndex = 0

  function appendChangedRegion(beforeEnd: number, afterEnd: number) {
    const paired = Math.min(beforeEnd - beforeIndex, afterEnd - afterIndex)
    for (let offset = 0; offset < paired; offset += 1) {
      result.push({
        before: before[beforeIndex + offset],
        beforeIndex: beforeIndex + offset,
        after: after[afterIndex + offset],
        afterIndex: afterIndex + offset,
        kind: 'changed'
      })
    }
    for (let index = beforeIndex + paired; index < beforeEnd; index += 1) {
      result.push({before: before[index], beforeIndex: index, kind: 'delete'})
    }
    for (let index = afterIndex + paired; index < afterEnd; index += 1) {
      result.push({after: after[index], afterIndex: index, kind: 'insert'})
    }
  }

  scanSequence(
    before.length,
    after.length,
    (left, right) => richTextBlocksMatch(before[left], after[right]),
    (length, commonBefore, commonAfter) => {
      appendChangedRegion(commonBefore, commonAfter)
      for (let offset = 0; offset < length; offset += 1) {
        const commonBeforeBlock = before[commonBefore + offset]
        const commonAfterBlock = after[commonAfter + offset]
        result.push({
          before: commonBeforeBlock,
          beforeIndex: commonBefore + offset,
          after: commonAfterBlock,
          afterIndex: commonAfter + offset,
          kind: richTextBlocksEqual(commonBeforeBlock, commonAfterBlock)
            ? 'same'
            : 'changed'
        })
      }
      beforeIndex = commonBefore + length
      afterIndex = commonAfter + length
    }
  )
  appendChangedRegion(before.length, after.length)
  return result
}

function richTextBlocksMatch(
  before: EntryDiffRichTextBlock,
  after: EntryDiffRichTextBlock
): boolean {
  if (before.id && after.id) return before.id === after.id
  return before.type === after.type && before.text === after.text
}

function richTextBlocksEqual(
  before: EntryDiffRichTextBlock,
  after: EntryDiffRichTextBlock
): boolean {
  return (
    before.type === after.type &&
    before.label === after.label &&
    before.text === after.text
  )
}

export function fieldChangeKind(
  field: EntryDiffField
): 'same' | 'local' | 'server' | 'conflict' {
  const hasServerValue = Object.hasOwn(field, 'serverValue')
  if (!hasServerValue)
    return valuesEqual(field.baseValue, field.localValue) ? 'same' : 'local'
  const localChanged = !valuesEqual(field.baseValue, field.localValue)
  const serverChanged = !valuesEqual(field.baseValue, field.serverValue)
  if (!localChanged && !serverChanged) return 'same'
  if (valuesEqual(field.localValue, field.serverValue)) return 'local'
  if (localChanged && serverChanged) return 'conflict'
  return localChanged ? 'local' : 'server'
}

export function resolvedFieldValue(
  field: EntryDiffField,
  resolutions: EntryDiffResolutions
): unknown {
  const resolution = resolutions[field.id]
  if (resolution?.choice === 'custom') return resolution.value ?? ''
  if (resolution?.choice === 'server') return field.serverValue
  if (resolution?.choice === 'local') return field.localValue
  return fieldChangeKind(field) === 'server'
    ? field.serverValue
    : field.localValue
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      key => Object.hasOwn(right, key) && valuesEqual(left[key], right[key])
    )
  )
}

function linkTitle(value: unknown): string {
  if (!isRecord(value)) return displayValue(value)
  return (
    recordString(value, '_title') ??
    recordString(value, 'title') ??
    recordString(value, 'label') ??
    (recordString(value, '_type') === 'entry' ? 'Entry link' : 'Untitled link')
  )
}

function linkTarget(value: unknown): string {
  if (!isRecord(value)) return ''
  const url = recordString(value, '_url') ?? recordString(value, 'url')
  if (url) return url
  const entry = recordString(value, '_entry') ?? recordString(value, 'entry')
  return entry ? `Entry · ${entry}` : 'No target'
}

function listItemTitle(value: unknown, index: number): string {
  if (!isRecord(value)) return `Item ${index + 1}`
  return (
    recordString(value, 'heading') ??
    recordString(value, 'title') ??
    recordString(value, 'label') ??
    `${recordString(value, '_type') ?? 'Item'} ${index + 1}`
  )
}

function listItemMeta(value: unknown): string {
  if (!isRecord(value)) return displayValue(value)
  return (
    recordString(value, 'text') ??
    recordString(value, 'summary') ??
    recordString(value, 'description') ??
    recordString(value, '_type') ??
    'List item'
  )
}

function richTextBlocks(value: unknown): Array<EntryDiffRichTextBlock> {
  if (!Array.isArray(value)) return []
  return value.map(node => {
    const type = recordString(node, '_type') ?? 'paragraph'
    return {
      id: recordString(node, '_id'),
      label: richTextBlockLabel(type, node),
      text: richTextContent(node) || `Empty ${type} block`,
      type
    }
  })
}

function richTextBlockLabel(type: string, node: unknown): string {
  if (type === 'heading' && isRecord(node)) {
    const level = node.level
    return typeof level === 'number' ? `Heading ${level}` : 'Heading'
  }
  if (type === 'bulletList') return 'Bulleted list'
  if (type === 'orderedList') return 'Numbered list'
  if (type === 'blockquote') return 'Quote'
  if (type === 'paragraph') return 'Paragraph'
  return type
}

function richTextContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value))
    return value.map(richTextContent).filter(Boolean).join(' ')
  if (!isRecord(value)) return ''
  return Object.entries(value)
    .filter(
      ([key]) =>
        key !== '_id' && key !== '_type' && key !== '_anchor' && key !== 'marks'
    )
    .map(([, child]) => richTextContent(child))
    .filter(Boolean)
    .join(' ')
}

function recordString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined
  const result = value[key]
  return typeof result === 'string' ? result : undefined
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Empty'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value))
    return `${value.length} ${value.length === 1 ? 'item' : 'items'}`
  if (isRecord(value)) return 'Structured value'
  return String(value)
}

function structuredKeyLabel(key: string): string {
  const label = key
    .replace(/^_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

function structuredValue(key: string, value: unknown): unknown {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    /(?:created|updated)At$/.test(key)
  ) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(milliseconds))
  }
  return value
}

function diffText(before: string, after: string): Array<EntryDiffSegment> {
  if (before === after) return [{kind: 'equal', text: after}]
  const beforeParts = splitText(before)
  const afterParts = splitText(after)
  const rows = beforeParts.length + 1
  const columns = afterParts.length + 1
  const lcs = Array.from({length: rows}, () => Array<number>(columns).fill(0))
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      lcs[row][column] =
        beforeParts[row - 1] === afterParts[column - 1]
          ? lcs[row - 1][column - 1] + 1
          : Math.max(lcs[row - 1][column], lcs[row][column - 1])
    }
  }
  const segments: Array<EntryDiffSegment> = []
  let row = beforeParts.length
  let column = afterParts.length
  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      beforeParts[row - 1] === afterParts[column - 1]
    ) {
      segments.unshift({kind: 'equal', text: beforeParts[row - 1]})
      row -= 1
      column -= 1
    } else if (
      column > 0 &&
      (row === 0 || lcs[row][column - 1] >= lcs[row - 1][column])
    ) {
      segments.unshift({kind: 'insert', text: afterParts[column - 1]})
      column -= 1
    } else {
      segments.unshift({kind: 'delete', text: beforeParts[row - 1]})
      row -= 1
    }
  }
  return mergeSegments(segments)
}

function splitText(value: string): Array<string> {
  return value.split(/(\s+|(?=[.,!?;:()[\]{}]))/).filter(Boolean)
}

function mergeSegments(
  segments: Array<EntryDiffSegment>
): Array<EntryDiffSegment> {
  return segments.reduce<Array<EntryDiffSegment>>((result, segment) => {
    const previous = result.at(-1)
    if (previous?.kind === segment.kind) previous.text += segment.text
    else result.push({...segment})
    return result
  }, [])
}
