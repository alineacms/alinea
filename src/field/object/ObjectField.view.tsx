import {
  Field,
  SortableList,
  SortableListItem,
  SortableListItemContent,
  SortableListItemDescription,
  SortableListItemHeader,
  SortableListItemIcon,
  SortableListItemLabel,
  SortableListItemTitle,
  SortableListItemToggle
} from '#/components.js'
import {EntryFields} from '#/dashboard/app/EntryFields.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions
} from '#/dashboard/hooks.js'
import {IcOutlineViewList} from '#/dashboard/icons.js'
import {rowSummary} from '#/field/list/RowSummary.js'
import {ObjectField} from '#/field/object.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw} from 'jotai'
import {useMemo, useState} from 'react'
import css from './ObjectField.module.css'

const styles = styler(css)

export interface ObjectFieldViewProps {
  field: ObjectField<object>
}

export function ObjectFieldView({field}: ObjectFieldViewProps) {
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const node = useFieldNode(field) as ReactiveNode<object>
  const [expanded, setExpanded] = useState(true)
  const summaryAtom = useMemo(
    () => atom(get => rowSummary(options.fields, get(node.value))),
    [node, options.fields]
  )
  const summary = useAtomValueRaw(summaryAtom)
  if (options.inline)
    return (
      <Field description={options.help} error={error} shared={options.shared}>
        <NodeEditor node={node} type={options.fields}>
          <EntryFields />
        </NodeEditor>
      </Field>
    )
  return (
    <Field description={options.help} error={error} shared={options.shared}>
      <SortableList aria-label={options.label}>
        <SortableListItem>
          <SortableListItemHeader>
            <SortableListItemTitle>
              <SortableListItemToggle
                aria-label={
                  expanded
                    ? `Collapse ${options.label}`
                    : `Expand ${options.label}`
                }
                expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              />
              <SortableListItemIcon
                icon={IcOutlineViewList}
                name={options.label}
              />
              <SortableListItemLabel>
                {options.label}
                {options.required && (
                  <span className={styles.ObjectFieldView.required()}>
                    {' *'}
                  </span>
                )}
              </SortableListItemLabel>
              {summary && (
                <SortableListItemDescription>
                  {summary}
                </SortableListItemDescription>
              )}
            </SortableListItemTitle>
          </SortableListItemHeader>
          {expanded && (
            <SortableListItemContent>
              <NodeEditor node={node} type={options.fields} />
            </SortableListItemContent>
          )}
        </SortableListItem>
      </SortableList>
    </Field>
  )
}
