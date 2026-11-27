import {Badge, ListError} from '#/components.js'
import {Field} from '#/core/Field.js'
import {isRecord} from '#/core/util/Objects.js'
import {useOtherVersions} from '#/dashboard/app/useMissingLanguages.js'
import {fieldSharingContext} from '#/dashboard/contexts.js'
import {IcRoundCallSplit} from '#/dashboard/icons.js'
import {
  type ListFieldBadgesProps,
  ListFieldView
} from '#/field/list/ListField.view.js'
import {useAtomValueRaw} from 'jotai'
import {useMemo} from 'react'
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
      <FormMailLanguages />
    </fieldSharingContext.Provider>
  )
}

/** The `{{key}}` problems of the texts of the other languages */
function FormMailLanguages() {
  const keys = useFormKeys()
  const versions = useOtherVersions()
  const problems = useMemo(() => {
    const result = new Set<string>()
    for (const version of versions) {
      // Form.type keeps its mails under this key
      const {mails} = version.data as {mails?: unknown}
      if (!Array.isArray(mails)) continue
      for (const mail of mails.filter(isRecord)) {
        const problem = mailTextProblem(mail, keys, version.locale!)
        if (problem) result.add(problem)
      }
    }
    return [...result]
  }, [keys, versions])
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
