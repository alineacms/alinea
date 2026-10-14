import {getType} from '#/core/Internal.js'
import {Type, type} from '#/core/Type.js'
import {IcOutlineSettings, IcRoundDescription} from '#/dashboard/icons.js'
import {tab, tabs} from '#/field/tabs.js'

const formTypes = new WeakMap<Type, Type>()

/**
 * The type an entry's form renders: the settings of a type that is not a
 * document (documents add their own tab) move to a Settings tab.
 */
export function withSettingsTab(entryType: Type): Type {
  const settings = Type.settings(entryType)
  if (!settings) return entryType
  let result = formTypes.get(entryType)
  if (result) return result
  const {fields, settings: _, ...config} = getType(entryType)
  result = type(Type.label(entryType), {
    ...config,
    fields: tabs(
      tab('Content', {icon: IcRoundDescription, fields}),
      tab('Settings', {icon: IcOutlineSettings, fields: settings})
    )
  })
  formTypes.set(entryType, result)
  return result
}
