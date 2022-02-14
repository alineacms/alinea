import {Field, Label, Type} from '@alinea/core'

export type TabsFieldOptions = {
  width?: number
  help?: Label
}

export type Tab = {
  label: Label
}

export type Tabs<T> = Array<Type>

export interface TabsField<T = any> extends Field<T> {
  types: Tabs<T>
  options: TabsFieldOptions
}

export function createTabs<T>(
  types: Tabs<T>,
  options: TabsFieldOptions = {}
): TabsField<T> {
  let type = types[0].valueType
  for (const add of types.slice(1)) {
    type = type.concat(add.valueType)
  }
  console.log(type)
  return {
    type,
    types,
    options
  }
}
