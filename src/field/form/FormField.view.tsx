import {Badge, Text} from '#/components.js'
import {Field} from '#/core/Field.js'
import type {FieldPath} from '#/core/Validation.js'
import {isRecord} from '#/core/util/Objects.js'
import {useFieldNode, useFieldOptions} from '#/dashboard/hooks.js'
import {
  type ListFieldBadgesProps,
  ListFieldView
} from '#/field/list/ListField.view.js'
import {type Atom, atom, useAtomValueRaw} from 'jotai'
import {createContext, useCallback, useContext, useMemo} from 'react'
import type {FormField} from './FormField.js'
import {defaults} from './FormInputs.js'

const builtIn = new Set<unknown>(Object.values(defaults))

/** The first error of each row by its id, from the outermost form field */
const FormErrors = createContext<Atom<Map<string, string>> | null>(null)

const none = atom(undefined)

export interface FormFieldViewProps {
  field: FormField
}

export function FormFieldView({field}: FormFieldViewProps) {
  const {inputs} = useFieldOptions(field)
  const parent = useContext(FormErrors)
  const node = useFieldNode(field)
  const errors = useMemo(
    () => parent ?? atom(get => rowErrors(field, get(node.value))),
    [parent, field, node]
  )
  const ownInputs = Object.values(inputs).some(input => !builtIn.has(input))
  const typeGroup = useCallback(
    (id: string) => {
      if (!ownInputs) return undefined
      return builtIn.has(inputs[id]) ? 'Inputs' : 'This project'
    },
    [inputs, ownInputs]
  )
  return (
    <FormErrors.Provider value={errors}>
      <ListFieldView
        field={field}
        labelField="label"
        badges={FormRowBadges}
        addLabel="Add input"
        typeGroup={typeGroup}
      />
    </FormErrors.Provider>
  )
}

function FormRowBadges({row}: ListFieldBadgesProps) {
  const errors = useContext(FormErrors)
  const id = useAtomValueRaw(row.field('_id')) as string
  const required = useAtomValueRaw(row.field('required'))
  const error = useAtomValueRaw(
    useMemo(
      () => (errors ? atom(get => get(errors).get(id)) : none),
      [errors, id]
    )
  )
  return (
    <>
      {required === true && <Badge size="sm">Required</Badge>}
      {error && (
        <Text size="sm" color="destructive">
          {error}
        </Text>
      )}
    </>
  )
}

// Most fields of an input are in its sheet, its row shows what is wrong
function rowErrors(field: FormField, value: unknown): Map<string, string> {
  const result = new Map<string, string>()
  const errors = Field.nestedErrors(field, value, {
    path: [],
    labels: [],
    scopes: []
  })
  for (const {path, labels, message} of errors) {
    const id = rowId(value, path)
    if (id && !result.has(id)) result.set(id, `${labels.at(-1)}: ${message}`)
  }
  return result
}

/** The innermost input or section the path leads to */
function rowId(rows: unknown, path: FieldPath): string | undefined {
  let id: string | undefined
  for (let i = 0; i < path.length; i += 2) {
    const row = Array.isArray(rows) ? rows[path[i] as number] : undefined
    if (!isRecord(row)) break
    id = row._id as string
    if (path[i + 1] !== 'inputs') break
    rows = row.inputs
  }
  return id
}
