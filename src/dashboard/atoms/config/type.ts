import {getType} from '#/core/Internal.js'
import {Type as ConfigType} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {dispense} from '../utils.js'
import {configAtom} from '../config.js'

export interface TypeAtoms {
  type: ConfigType
  readonly contains: ReturnType<typeof getType>['contains']
  readonly label: ReturnType<typeof getType>['label']
  readonly orderChildrenBy: ReturnType<typeof getType>['orderChildrenBy']
  readonly defaultView: ReturnType<typeof ConfigType.defaultView>
  readonly icon: ReturnType<typeof getType>['icon']
  readonly sections: ReturnType<typeof getType>['sections']
}

export function createType(type: ConfigType): TypeAtoms {
  const settings = getType(type)
  return {
    type,
    contains: settings.contains,
    label: settings.label,
    orderChildrenBy: settings.orderChildrenBy,
    defaultView: ConfigType.defaultView(type),
    icon: settings.icon,
    sections: settings.sections
  }
}

export const typeAtoms = dispense((key: string) =>
  atom(get => {
    const config = get(configAtom)
    const type = config.schema[key]
    assert(type, `Type "${key}" not found in config`)
    return createType(type)
  })
)
