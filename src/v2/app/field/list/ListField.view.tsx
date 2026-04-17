import {createId} from '#/core/Id.js'
import {getType} from '#/core/Internal.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {ListField as CoreListField} from '#/core/field/ListField.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {ListOptions} from '#/field/list.js'
import {NodeEditor} from '#/v2/app/Editor.js'
import {
  IcOutlineList,
  IcRoundAdd,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundDelete
} from '#/v2/icons.js'
import {ReactiveNode} from '#/v2/store/Dashboard.js'
import {
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes
} from '#/v2/store/hooks.js'
import {Button, Icon, Label} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import {Box, BoxContent, BoxHeader, BoxRow} from '../../Box'
import css from './ListField.module.css'

const styles = styler(css)

interface ListValue {
  _id: string
  _type: string
  [key: string]: unknown
}

export interface ListFieldViewProps {
  field: CoreListField<ListRow, ListValue, ListOptions<Schema>>
}

export function ListFieldView({field}: ListFieldViewProps) {
  const options = useFieldOptions(field) as ListOptions<Schema>
  const error = useFieldError(field)
  const list = useFieldNode(field) as ReactiveNode<Array<ListValue>>
  const nodes = useNodes(list) as Array<ReactiveNode<ListValue>>
  const setRows = useSetAtom(list.value)
  const schemaEntries = useMemo(
    () => Object.entries(options.schema),
    [options.schema]
  )
  const readOnly = Boolean(options.readOnly)
  const hasRows = nodes.length > 0

  function addRow(typeName: string, type: Schema[string]) {
    setRows(current => {
      const initialValue = Type.initialValue(type) as Record<string, unknown>
      return [
        ...current,
        {
          _id: createId(),
          _index: '',
          _type: typeName,
          ...initialValue
        }
      ]
    })
  }

  const content =
    hasRows || !readOnly ? (
      <Box className={styles.rowsBox()} role="list">
        <BoxRow>
          <BoxHeader>{options.label}</BoxHeader>
        </BoxRow>
        {hasRows ? (
          nodes.map((row, index) => (
            <ListFieldRow
              index={index}
              key={index}
              list={list}
              readOnly={readOnly}
              row={row}
              rows={nodes.length}
              schema={options.schema}
            />
          ))
        ) : (
          <BoxContent>
            <div className={styles.empty()}>No items yet.</div>
          </BoxContent>
        )}
        {!readOnly && (
          <BoxRow position="middle">
            <div className={styles.create()}>
              {schemaEntries.map(([typeName, type]) => (
                <Button
                  key={typeName}
                  appearance="plain"
                  intent="secondary"
                  onPress={() => addRow(typeName, type)}
                >
                  <Icon aria-hidden icon={getType(type).icon || IcRoundAdd} />
                  {`Add ${Type.label(type)}`}
                </Button>
              ))}
            </div>
          </BoxRow>
        )}
      </Box>
    ) : (
      <div className={styles.empty()}>No items yet.</div>
    )

  return (
    <Label errorMessage={error}>
      <div className={styles.root()}>{content}</div>
    </Label>
  )
}

interface ListFieldRowProps {
  index: number
  list: ReactiveNode<Array<ListValue>>
  readOnly: boolean
  row: ReactiveNode<ListValue>
  rows: number
  schema: Schema
}

function ListFieldRow({
  index,
  list,
  readOnly,
  row,
  rows,
  schema
}: ListFieldRowProps) {
  const typeName = useAtomValue(row.field('_type')) as string
  const setRows = useSetAtom(list.value)
  const type = schema[typeName]

  if (!type) return null

  const label = Type.label(type)
  const icon = getType(type).icon || IcOutlineList

  function moveRow(direction: -1 | 1) {
    setRows(current => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  function deleteRow() {
    setRows(current =>
      current.filter((_, currentIndex) => currentIndex !== index)
    )
  }

  return (
    <section
      aria-label={`${label} item ${index + 1}`}
      className={styles.ListFieldRow()}
      role="listitem"
    >
      <BoxRow className={styles.ListFieldRow.header()}>
        <BoxHeader className={styles.ListFieldRow.leading()}>
          <Icon aria-hidden icon={icon} />
          <strong className={styles.title()}>{label}</strong>
        </BoxHeader>
        <div className={styles.ListFieldRow.actions()}>
          <Button
            aria-label={`Move ${label} up`}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly || index === 0}
            onPress={() => moveRow(-1)}
          >
            <Icon aria-hidden icon={IcRoundArrowUpward} />
          </Button>
          <Button
            aria-label={`Move ${label} down`}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly || index === rows - 1}
            onPress={() => moveRow(1)}
          >
            <Icon aria-hidden icon={IcRoundArrowDownward} />
          </Button>
          <Button
            aria-label={`Remove ${label}`}
            className={styles.ListFieldRow.action()}
            isDisabled={readOnly}
            onPress={deleteRow}
          >
            <Icon aria-hidden icon={IcRoundDelete} />
          </Button>
        </div>
      </BoxRow>
      <BoxContent className={styles.body()}>
        <NodeEditor
          node={row as ReactiveNode<object>}
          surface="plain"
          type={type}
        />
      </BoxContent>
    </section>
  )
}
