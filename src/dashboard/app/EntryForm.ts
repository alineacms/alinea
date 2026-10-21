import {getType} from '#/core/Internal.js'
import {Type, type} from '#/core/Type.js'
import {values} from '#/core/util/Objects.js'
import {IcRoundDescription} from '#/dashboard/icons.js'
import {tab, tabs} from '#/field/tabs.js'

const formTypes = new WeakMap<Type, Type>()

/**
 * The type an entry's form renders: a type that is not a document (documents
 * add their own tabs) shows its fields in a Content tab, followed by its tabs.
 */
export function entryForm(entryType: Type): Type {
  const extraTabs = Type.tabs(entryType)
  if (!extraTabs) return entryType
  let result = formTypes.get(entryType)
  if (result) return result
  const {fields, tabs: _tabs, ...config} = getType(entryType)
  result = type(Type.label(entryType), {
    ...config,
    fields: tabs(
      tab('Content', {icon: IcRoundDescription, fields}),
      ...values(extraTabs)
    )
  })
  formTypes.set(entryType, result)
  return result
}
