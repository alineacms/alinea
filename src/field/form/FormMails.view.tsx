import {Badge} from '#/components.js'
import {IcRoundCallSplit} from '#/dashboard/icons.js'
import {
  type ListFieldBadgesProps,
  ListFieldView
} from '#/field/list/ListField.view.js'
import {useAtomValueRaw} from 'jotai'
import {useMemo} from 'react'
import {describeCondition, entryLabel} from './FormRules.js'
import type {FormMailList} from './FormType.js'
import {useFormOrder} from './UseFormOrder.js'

export interface FormMailsViewProps {
  field: FormMailList
}

/** The notification mails of a form, named by their name */
export function FormMailsView({field}: FormMailsViewProps) {
  return (
    <ListFieldView field={field} labelField="name" badges={FormMailBadges} />
  )
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
