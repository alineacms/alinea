import {getType} from '#/core/Internal.js'
import {Type, type} from '#/core/Type.js'
import {values} from '#/core/util/Objects.js'
import {IcOutlineSettings, IcRoundDescription} from '#/dashboard/icons.js'
import {tab, tabs} from '#/field/tabs.js'

const formTypes = new WeakMap<Type, Type>()

/**
 * The type an entry's form renders: a type that is not a document (documents
 * add their own tabs) shows its fields in a Content tab, followed by its
 * custom tabs and a Settings tab for its settings.
 */
export function entryForm(entryType: Type): Type {
  const settings = Type.settings(entryType)
  const extraTabs = Type.tabs(entryType)
  if (!settings && !extraTabs) return entryType
  let result = formTypes.get(entryType)
  if (result) return result
  const {
    fields,
    settings: _settings,
    tabs: _tabs,
    ...config
  } = getType(entryType)
  result = type(Type.label(entryType), {
    ...config,
    fields: tabs(
      tab('Content', {icon: IcRoundDescription, fields}),
      ...values(extraTabs ?? {}),
      ...(settings
        ? [tab('Settings', {icon: IcOutlineSettings, fields: settings})]
        : [])
    )
  })
  formTypes.set(entryType, result)
  return result
}
