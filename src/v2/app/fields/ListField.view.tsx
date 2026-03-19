import {Button, Elevation, Icon, Label, List, ListItem} from '@alinea/components'
import styler from '@alinea/styler'
import {createId} from 'alinea/core/Id.js'
import {getType} from 'alinea/core/Internal.js'
import {Schema} from 'alinea/core/Schema'
import {Type} from 'alinea/core/Type'
import {ListField as CoreListField} from 'alinea/core/field/ListField.js'
import {ListRow} from 'alinea/core/shape/ListShape.js'
import {ListOptions} from 'alinea/field/list'
import {NodeEditor} from 'alinea/v2/app/Editor'
import {
  IcOutlineList,
  IcRoundAdd,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundDelete
} from 'alinea/v2/icons'
import {
  ArrayNode,
  Node,
  ObjectNode,
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes
} from 'alinea/v2/store'
import {useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
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
  const list = useFieldNode(field) as ArrayNode<ListValue>
  const nodes = useNodes(list) as Array<ObjectNode<ListValue>>
  const setRows = useSetAtom(list.value)
  const schemaEntries = useMemo(() => Object.entries(options.schema), [options])
  const readOnly = Boolean(options.readOnly)
  return (
    <Label label={options.label} errorMessage={error}>
      <div className={styles.root()}>
        {nodes.length > 0 ? (
          <List className={styles.rows()}>
            {nodes.map((row, index) => (
              <ListFieldRow
                index={index}
                key={index}
                list={list}
                readOnly={readOnly}
                row={row}
                rows={nodes.length}
                schema={options.schema}
              />
            ))}
          </List>
        ) : (
          <div className={styles.empty()}>No items yet.</div>
        )}

        {!readOnly && (
          <div className={styles.create()}>
            {schemaEntries.map(([typeName, type]) => (
              <Button
                key={typeName}
                onPress={() =>
                  setRows(current => {
                    const initialValue = Type.initialValue(type) as Record<
                      string,
                      unknown
                    >
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
              >
                <Icon aria-hidden icon={getType(type).icon || IcRoundAdd} />
                {`Add ${Type.label(type)}`}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Label>
  )
}

interface ListFieldRowProps {
  index: number
  list: ArrayNode<ListValue>
  readOnly: boolean
  row: ObjectNode<ListValue>
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
  const typeName = useAtomValue(row.field._type) as string
  const setRows = useSetAtom(list.value)
  const type = schema[typeName]
  if (!type) return null
  const label = Type.label(type)
  const icon = getType(type).icon || IcOutlineList
  return (
    <section aria-label={`${label} item ${index + 1}`} className={styles.row()}>
      <ListItem
        inner={
          <Elevation className={styles.inner()}>
            <div className={styles.body()}>
              <NodeEditor node={row as Node} type={type} />
            </div>
          </Elevation>
        }
        leading={<Icon aria-hidden icon={icon} />}
        trailing={
          <div className={styles.actions()}>
            <Button
              aria-label={`Move ${label} up`}
              className={styles.action()}
              isDisabled={readOnly || index === 0}
              onPress={() =>
                setRows(current => {
                  const nextIndex = index - 1
                  if (nextIndex < 0) return current
                  const next = [...current]
                  const item = next[index]
                  next[index] = next[nextIndex]
                  next[nextIndex] = item
                  return next
                })
              }
            >
              <Icon aria-hidden icon={IcRoundArrowUpward} />
            </Button>
            <Button
              aria-label={`Move ${label} down`}
              className={styles.action()}
              isDisabled={readOnly || index === rows - 1}
              onPress={() =>
                setRows(current => {
                  const nextIndex = index + 1
                  if (nextIndex >= current.length) return current
                  const next = [...current]
                  const item = next[index]
                  next[index] = next[nextIndex]
                  next[nextIndex] = item
                  return next
                })
              }
            >
              <Icon aria-hidden icon={IcRoundArrowDownward} />
            </Button>
            <Button
              aria-label={`Remove ${label}`}
              className={styles.action()}
              isDisabled={readOnly}
              onPress={() =>
                setRows(current =>
                  current.filter((_, currentIndex) => currentIndex !== index)
                )
              }
            >
              <Icon aria-hidden icon={IcRoundDelete} />
            </Button>
          </div>
        }
      >
        <strong className={styles.title()}>{label}</strong>
      </ListItem>
    </section>
  )
}
