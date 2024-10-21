import {FieldInternal} from './Field.js'
import {RootInternal} from './Root.js'
import {TypeInternal} from './Type.js'
import {WorkspaceInternal} from './Workspace.js'

export const internalRoot = Symbol('@alinea.Root')
export interface HasRoot {
  [internalRoot]: RootInternal
}
export const hasRoot = (obj: object): obj is HasRoot => internalRoot in obj
export const getRoot = (obj: HasRoot) => obj[internalRoot]

export const internalType = Symbol('@alinea.Type')
export interface HasType {
  [internalType]: TypeInternal
}
export const hasType = (obj: object): obj is HasType => internalType in obj
export const getType = (obj: HasType) => obj[internalType]

export const internalField = Symbol('@alinea.Field')
export interface HasField {
  [internalField]: FieldInternal
}
export const hasField = (obj: object): obj is HasField => internalField in obj
export const getField = (obj: HasField) => obj[internalField]

export const internalWorkspace = Symbol('@alinea.Workspace')
export interface HasWorkspace {
  [internalWorkspace]: WorkspaceInternal
}
export const hasWorkspace = (obj: object): obj is HasWorkspace =>
  internalWorkspace in obj
export const getWorkspace = (obj: HasWorkspace) => obj[internalWorkspace]
