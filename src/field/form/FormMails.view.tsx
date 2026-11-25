import {Badge, ListError} from '#/components.js'
import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord} from '#/core/util/Objects.js'
import type {EntryAtoms} from '#/dashboard/atoms/entry.js'
import {rootEditor} from '#/dashboard/atoms/editor.js'
import {entryContext, fieldSharingContext} from '#/dashboard/contexts.js'
import {useEditor, useLocale} from '#/dashboard/hooks.js'
import {IcRoundCallSplit} from '#/dashboard/icons.js'
import {
  type ListFieldBadgesProps,
  ListFieldView
} from '#/field/list/ListField.view.js'
import {useAtomValueRaw} from 'jotai'
import {useContext, useMemo} from 'react'
import {mailTextProblem} from './FormMails.js'
import {describeCondition, entryLabel} from './FormRules.js'
import {isSharedFormField} from './FormShare.js'
import type {FormMailList} from './FormType.js'
import {useFormKeys, useFormOrder} from './UseFormOrder.js'

export interface FormMailsViewProps {
  field: FormMailList
}

/** The notification mails of a form, named by their name */
export function FormMailsView({field}: FormMailsViewProps) {
  const view = (
    <ListFieldView field={field} labelField="name" badges={FormMailBadges} />
  )
  if (!Field.options(field).shared) return view
  // The mails of a shared form share all but their subject and body
  return (
    <fieldSharingContext.Provider value={isSharedFormField}>
      {view}
      <FormMailLanguages field={field} />
    </fieldSharingContext.Provider>
  )
}

/** The `{{key}}` problems of the texts of the other languages */
function FormMailLanguages({field}: FormMailsViewProps) {
  const context = useContext(entryContext)
  if (!context) return null
  return <FormMailLanguageCheck field={field} data={context.entry.data} />
}

interface FormMailLanguageCheckProps extends FormMailsViewProps {
  data: EntryAtoms['data']
}

function FormMailLanguageCheck({field, data}: FormMailLanguageCheckProps) {
  const editor = rootEditor(useEditor())
  const locale = useLocale()
  const keys = useFormKeys()
  const {entries: versions} = useAtomValueRaw(data)
  const problems = useMemo(() => {
    const key = entries(Type.fields(editor.type)).find(
      ([, other]) => other === field
    )?.[0]
    if (!key || !locale) return []
    const result = new Set<string>()
    for (const version of versions) {
      if (!version.locale || version.locale === locale) continue
      const mails = (version.data as Record<string, unknown>)[key]
      if (!Array.isArray(mails)) continue
      for (const mail of mails.filter(isRecord)) {
        const problem = mailTextProblem(mail, keys, version.locale)
        if (problem) result.add(problem)
      }
    }
    return [...result]
  }, [editor, field, keys, locale, versions])
  return problems.map(problem => <ListError key={problem}>{problem}</ListError>)
}

function FormMailBadges({row}: ListFieldBadgesProps) {
  const order = useFormOrder()
  const byId = useMemo(
    () => new Map(order.map(entry => [entry.row._id, entry])),
    [order]
  )
  const to = useAtomValueRaw(row.field('to'))
  const address = useAtomValueRaw(row.field('address'))
  const input = useAtomValueRaw(row.field('input'))
  const sendWhen = useAtomValueRaw(row.field('sendWhen'))
  const target = typeof input === 'string' ? byId.get(input) : undefined
  const recipient =
    to === 'input'
      ? target && `To the ${entryLabel(target)} input`
      : typeof address === 'string' && address
  const when = describeCondition(sendWhen, byId)
  return (
    <>
      {recipient && <Badge size="sm">{recipient}</Badge>}
      {when && (
        <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
          When {when}
        </Badge>
      )}
    </>
  )
}
