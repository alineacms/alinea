import {Entry} from '@alinea/core/Entry'
import {SelectionInput} from '@alinea/store/Selection'
import {GraphQLResolveInfo, SelectionNode, SelectionSetNode} from 'graphql'
import {Pages} from '../Pages'

export class GraphQLResolver {
  constructor(public resolver: Pages) {}

  async pages(source: undefined, args: {}, info: GraphQLResolveInfo) {
    const fields = Object.fromEntries(
      this.fieldsOfSet(info, info.fieldNodes[0].selectionSet!).concat([
        ['__type', Entry.type]
      ])
    )
    const requested = await this.resolver.select(fields)
    console.log(requested)
    return requested
  }

  getField(name: string, type?: string) {
    return Entry.get(name)
  }

  fieldsOfNode(
    info: GraphQLResolveInfo,
    field: SelectionNode
  ): Array<[string, SelectionInput]> {
    switch (field.kind) {
      case 'Field':
        const alias = field.alias?.value || field.name.value
        if (!field.selectionSet)
          return [[alias, this.getField(field.name.value)]]
        return [
          [
            alias,
            Object.fromEntries(this.fieldsOfSet(info, field.selectionSet))
          ]
        ]
      case 'FragmentSpread':
        const fragment = info.fragments[field.name.value]
        return this.fieldsOfSet(info, fragment.selectionSet)
      case 'InlineFragment':
        return this.fieldsOfSet(info, field.selectionSet)
      default:
        throw new Error(`Unknown field kind ${field.kind}`)
    }
  }

  fieldsOfSet(
    info: GraphQLResolveInfo,
    set: SelectionSetNode
  ): Array<[string, SelectionInput]> {
    return set.selections.flatMap(node => this.fieldsOfNode(info, node))
  }
}
