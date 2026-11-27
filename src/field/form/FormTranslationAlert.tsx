import {Alert, AlertDescription, AlertTitle} from '#/components.js'
import {useOtherVersions} from '#/dashboard/app/useMissingLanguages.js'
import {useEditor, useFieldOptions} from '#/dashboard/hooks.js'
import {IcRoundTranslate} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {useMemo} from 'react'
import {type FormField, formOf} from './FormField.js'
import css from './FormTranslationAlert.module.css'
import {translationDifferences} from './FormTranslations.js'

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
export function FormTranslationAlert({field, rows}: FormTranslationAlertProps) {
  const {inputs} = useFieldOptions(field)
  const key = formOf(useEditor().type)?.key
  const versions = useOtherVersions()
  const differences = useMemo(() => {
    if (!key) return []
    const others = versions.map(version => ({
      locale: version.locale!,
      rows: (version.data as Record<string, unknown>)[key]
    }))
    return translationDifferences(inputs, rows, others)
  }, [inputs, key, rows, versions])
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
