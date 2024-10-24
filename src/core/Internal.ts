import {ExprInternal} from './Expr.js'
import {FieldInternal} from './Field.js'
import {RootInternal} from './Root.js'
import {TypeInternal} from './Type.js'
import {WorkspaceInternal} from './Workspace.js'

// The choice of types over interfaces is to work around
// microsoft/TypeScript#15300
// Where an extern class is used this is to work around
// microsoft/TypeScript#57165
// because then the property is marked as non-enumerable

export const internalRoot = Symbol.for('@alinea.Root')
export type HasRoot = {
  readonly [internalRoot]: RootInternal
}
export const hasRoot = (obj: object): obj is HasRoot => internalRoot in obj
export const getRoot = (obj: HasRoot) => obj[internalRoot]

export const internalType = Symbol.for('@alinea.Type')
export declare class HasType {
  get [internalType](): TypeInternal
}
export const hasType = (obj: object): obj is HasType => internalType in obj
export const getType = (obj: HasType) => obj[internalType]

export const internalField = Symbol.for('@alinea.Field')
export type HasField = {
  readonly [internalField]: FieldInternal
}
export const hasField = (obj: object): obj is HasField => internalField in obj
export const getField = (obj: HasField) => obj[internalField]

export const internalWorkspace = Symbol.for('@alinea.Workspace')
export type HasWorkspace = {
  [internalWorkspace]: WorkspaceInternal
}
export const hasWorkspace = (obj: object): obj is HasWorkspace =>
  internalWorkspace in obj
export const getWorkspace = (obj: HasWorkspace) => obj[internalWorkspace]

export const internalExpr = Symbol.for('@alinea.Expr')
export type HasExpr = {
  readonly [internalExpr]: ExprInternal
}
export const hasExpr = (obj: object): obj is HasExpr => internalExpr in obj
export const getExpr = (obj: HasExpr) => obj[internalExpr]
