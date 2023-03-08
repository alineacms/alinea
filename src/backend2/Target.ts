import {Hub} from 'alinea/core'

export interface Target {
  canRename: boolean
  publish(params: Hub.ChangesParams, ctx: Hub.Context): Promise<void>
}
