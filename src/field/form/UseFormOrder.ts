import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {rootEditor} from '#/dashboard/atoms/editor.js'
import {useEditor} from '#/dashboard/hooks.js'
import {atom, useAtomValueRaw} from 'jotai'
import {useMemo} from 'react'
import {FormField} from './FormField.js'
import type {Input} from './FormInput.js'
import {answerKeys} from './FormMails.js'
import {type FormEntry, readingOrder} from './FormRules.js'

const none = atom(undefined)

/**
 * The rows of the form in the entry being edited, in reading order. Works
 * from anywhere in the entry, eg. the sheet of a mail in its Notifications.
 */
export function useFormOrder(): Array<FormEntry> {
  const {inputs, rows} = useFormRows()
  return useMemo(
    () => (inputs ? readingOrder(inputs, rows) : []),
    [inputs, rows]
  )
}

/** The keys of the form in the entry being edited, see `answerKeys` */
export function useFormKeys(): Set<string> {
  const {inputs, rows} = useFormRows()
  return useMemo(
    () => (inputs ? answerKeys(inputs, rows) : new Set<string>()),
    [inputs, rows]
  )
}

function useFormRows(): {inputs?: Record<string, Input>; rows: unknown} {
  const editor = rootEditor(useEditor())
  const [key, field] =
    entries(Type.fields(editor.type)).find(
      ([, field]) => field instanceof FormField
    ) ?? []
  const rows = useAtomValueRaw(
    useMemo(() => (key ? editor.node.field(key) : none), [editor, key])
  )
  return {
    inputs:
      field instanceof FormField ? Field.options(field).inputs : undefined,
    rows
  }
}
