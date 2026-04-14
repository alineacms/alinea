import {
  Button,
  Icon
} from '@alinea/components'
import styler from '@alinea/styler'
import { createId } from 'alinea/core/Id'
import { getType } from 'alinea/core/Internal'
import { Schema } from 'alinea/core/Schema'
import { Type } from 'alinea/core/Type'
import { ListField as CoreListField } from 'alinea/core/field/ListField'
import { ListRow } from 'alinea/core/shape/ListShape'
import { ListOptions } from 'alinea/field/list'
import { NodeEditor } from 'alinea/v2/app/Editor'
import {
  IcOutlineList,
  IcRoundAdd,
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundDelete
} from 'alinea/v2/icons'
import {
  ReactiveNode,
  useFieldError,
  useFieldNode,
  useFieldOptions,
  useNodes
} from 'alinea/v2/store'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import { Box, BoxContent, BoxHeader, BoxRow } from '../../Box'
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
  const schemaEntries = useMemo(() => Object.entries(options.schema), [options])
  const readOnly = Boolean(options.readOnly)
  const hasRows = nodes.length > 0
  return (
      <div className={styles.root()}>
        {hasRows || !readOnly ? (
          <Box className={styles.rowsBox()} role="list">
            <BoxRow>
              <BoxHeader>
                {options.label}
              </BoxHeader>
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
                      appearance='plain'
                      intent='secondary'
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
              </BoxRow>
            )}
          </Box>
        ) : (
          <div className={styles.empty()}>No items yet.</div>
        )}
      </div>
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
  return (
    <section
      aria-label={`${label} item ${index + 1}`}
      className={styles.row()}
      role="listitem"
    >
        <BoxRow className={styles.header()}>
          <BoxHeader className={styles.leading()}>
            <Icon aria-hidden icon={icon} />
            <strong className={styles.title()}>{label}</strong>
          </BoxHeader>
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
