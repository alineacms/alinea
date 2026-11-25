import {Alert, AlertDescription, AlertTitle} from '#/components.js'
import type {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import type {EntryAtoms} from '#/dashboard/atoms/entry.js'
import {entryContext} from '#/dashboard/contexts.js'
import {useEditor, useFieldOptions, useLocale} from '#/dashboard/hooks.js'
import {IcRoundTranslate} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {useContext, useMemo} from 'react'
import type {FormField} from './FormField.js'
import css from './FormTranslationAlert.module.css'
import {
  type FormTranslation,
  translationDifferences
} from './FormTranslations.js'

const styles = styler(css)

export interface FormTranslationAlertProps {
  field: FormField
  /** The rows of the form as they are being edited */
  rows: unknown
}

/**
 * Warns when other languages of the entry ask other questions, which then
 * do not line up in submissions and exports
 */
export function FormTranslationAlert(props: FormTranslationAlertProps) {
  const context = useContext(entryContext)
  if (!context) return null
  return <FormTranslationCheck {...props} entries={context.entry.data} />
}

interface FormTranslationCheckProps extends FormTranslationAlertProps {
  /** The entry in every language and status */
  entries: EntryAtoms['data']
}

function FormTranslationCheck({
  field,
  rows,
  entries: data
}: FormTranslationCheckProps) {
  const {inputs} = useFieldOptions(field)
  const editor = useEditor()
  const locale = useLocale()
  const {entries: versions} = useAtomValueRaw(data)
  const key = useMemo(
    () =>
      entries(Type.fields(editor.type)).find(
        ([, other]) => other === field
      )?.[0],
    [editor, field]
  )
  const differences = useMemo(() => {
    if (!key || !locale) return []
    return translationDifferences(
      inputs,
      rows,
      otherLanguages(versions, locale, key)
    )
  }, [inputs, key, locale, rows, versions])
  if (differences.length === 0) return null
  return (
    <Alert
      variant="warning"
      icon={IcRoundTranslate}
      className={styles.FormTranslationAlert()}
    >
      <AlertTitle>Other languages ask other questions</AlertTitle>
      <AlertDescription>
        Answers are stored by key, so submissions and exports only line up when
        every language has the same keys, input types and option keys.
      </AlertDescription>
      <ul className={styles.FormTranslationAlert.list()}>
        {differences.flatMap(difference =>
          difference.problems.map(problem => (
            <li key={difference.locale + problem}>{problem}</li>
          ))
        )}
      </ul>
    </Alert>
  )
}

const statusOrder = ['published', 'draft', 'archived']

/** The form of each other language, published before a draft */
function otherLanguages(
  versions: Array<Entry>,
  locale: string,
  key: string
): Array<FormTranslation> {
  const byLocale = new Map<string, FormTranslation>()
  const sorted = [...versions].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
  )
  for (const version of sorted) {
    const other = version.locale
    if (!other || other === locale || byLocale.has(other)) continue
    const data = version.data as Record<string, unknown>
    byLocale.set(other, {locale: other, rows: data[key]})
  }
  return [...byLocale.values()]
}
