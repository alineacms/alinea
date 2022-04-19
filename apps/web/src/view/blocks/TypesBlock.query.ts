import {Store} from '@alinea/store'
import {
  Loc,
  Module,
  Node,
  NodeWithManyLOC,
  TypescriptExtractor
} from '@ts-docs/extractor'
import path from 'node:path'
import {Pages} from '../../../.alinea/web'
import {TypesBlockSchema} from './TypesBlock.schema'

export enum MemberType {
  Class,
  Constant,
  Enum,
  Function,
  Interface,
  Type
}

export type Member<T> = {
  type: MemberType
  name: string
  loc: Loc | Array<Loc>
}

function members<T extends Node | NodeWithManyLOC>(
  type: MemberType,
  list: Array<T>
): Array<Member<T>> {
  return list.map(item => ({type, name: item.name, loc: item.loc}))
}

function membersOf(module: Module) {
  return members<any>(MemberType.Class, module.classes)
    .concat(members(MemberType.Constant, module.constants))
    .concat(members(MemberType.Enum, module.enums))
    .concat(members(MemberType.Function, module.functions))
    .concat(members(MemberType.Interface, module.interfaces))
    .concat(members(MemberType.Type, module.types))
}

export async function typesBlockQuery(pages: Pages, block: TypesBlockSchema) {
  const {entryPoint, exports} = block
  const extractor = new TypescriptExtractor({
    entryPoints: [path.join('../..', entryPoint)]
  })
  const include = new Set(exports.split(','))
  const module = extractor.run()[0].module
  return {
    ...block,
    entryPoint,
    members: membersOf(module).filter(member => include.has(member.name))
  }
}

export type TypesBlockProps = Store.TypeOf<ReturnType<typeof typesBlockQuery>>
