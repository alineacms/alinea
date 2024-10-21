import {FieldInternal} from './Field.js'
import {RootInternal} from './Root.js'
import {TypeInternal} from './Type.js'
import {WorkspaceInternal} from './Workspace.js'

export const internalRoot = Symbol('@alinea.Root')
export declare class HasRoot {
  get [internalRoot](): RootInternal
}
export const hasRoot = (obj: object): obj is HasRoot => internalRoot in obj
export const getRoot = (obj: HasRoot) => obj[internalRoot]

export const internalType = Symbol('@alinea.Type')
export declare class HasType {
  get [internalType](): TypeInternal
}
export const hasType = (obj: object): obj is HasType => internalType in obj
export const getType = (obj: HasType) => obj[internalType]

export const internalField = Symbol('@alinea.Field')
export declare class HasField {
  get [internalField](): FieldInternal
}
export const hasField = (obj: object): obj is HasField => internalField in obj
export const getField = (obj: HasField) => obj[internalField]

export const internalWorkspace = Symbol('@alinea.Workspace')
export declare class HasWorkspace {
  get [internalWorkspace](): WorkspaceInternal
}
export const hasWorkspace = (obj: object): obj is HasWorkspace =>
  internalWorkspace in obj
export const getWorkspace = (obj: HasWorkspace) => obj[internalWorkspace]
