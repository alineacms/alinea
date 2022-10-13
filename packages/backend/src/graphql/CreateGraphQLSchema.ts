import {createError} from '@alinea/core/ErrorWithCode'
import {Hint} from '@alinea/core/Hint'
import {Schema} from '@alinea/core/Schema'
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedOutputType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType
} from 'graphql'

namespace Builtins {
  export const EntryI18N = new GraphQLObjectType({
    name: 'EntryI18N',
    fields: {
      id: {type: GraphQLID},
      locale: {type: GraphQLString},
      parent: {type: GraphQLString},
      parents: {type: new GraphQLList(GraphQLString)}
    }
  })
  export const EntryMeta = new GraphQLObjectType({
    name: 'EntryMeta',
    fields: {
      workspace: {type: GraphQLString},
      root: {type: GraphQLString},
      parent: {type: GraphQLString},
      parents: {type: new GraphQLList(GraphQLString)},
      isContainer: {type: GraphQLBoolean},
      i18n: {type: EntryI18N}
    }
  })
  export const Entry = new GraphQLInterfaceType({
    name: 'Entry',
    fields: {
      id: {type: GraphQLID},
      type: {type: GraphQLString},
      url: {type: GraphQLString},
      title: {type: GraphQLString},
      path: {type: GraphQLString},
      alinea: {type: EntryMeta}
    }
  })
  export const Query = new GraphQLObjectType({
    name: 'Query',
    fields: {
      pages: {type: Entry}
    }
  })
  // Todo: some day we might want packages to add their own definitions
  export const UrlReference = new GraphQLObjectType({
    name: 'UrlReference',
    fields: {
      type: {type: GraphQLString},
      url: {type: GraphQLString},
      description: {type: GraphQLString},
      target: {type: GraphQLString}
    }
  })
  export const EntryReference = new GraphQLObjectType({
    name: 'EntryReference',
    fields: {
      type: {type: GraphQLString},
      entry: {type: GraphQLString},
      entryType: {type: GraphQLString},
      path: {type: GraphQLString},
      title: {type: GraphQLString},
      url: {type: GraphQLString},
      alinea: {type: EntryMeta}
    }
  })
  export const FileReference = new GraphQLObjectType({
    name: 'FileReference',
    fields: {
      type: {type: GraphQLString},
      src: {type: GraphQLString},
      url: {type: GraphQLString},
      extension: {type: GraphQLString},
      size: {type: GraphQLInt},
      alinea: {type: EntryMeta}
    }
  })
  export const ImageReference = new GraphQLInterfaceType({
    name: 'ImageReference',
    fields: {
      type: {type: GraphQLString},
      src: {type: GraphQLString},
      extension: {type: GraphQLString},
      size: {type: GraphQLInt},
      hash: {type: GraphQLString},
      width: {type: GraphQLInt},
      height: {type: GraphQLInt},
      averageColor: {type: GraphQLString},
      blurHash: {type: GraphQLString},
      alinea: {type: EntryMeta}
    }
  })
  export const TextDoc = new GraphQLScalarType({name: 'TextDoc'})
}

export function createGraphQLSchema(schema: Schema) {
  const hints = schema.allTypes.map(type => type.hint)
  const cache = new Map<string, GraphQLNamedOutputType>(
    Object.entries(Builtins)
  )
  const types: Array<GraphQLNamedOutputType> = []
  for (const definition of Hint.definitions(hints)) {
    const type = graphQLTypeOf(definition, {
      types: cache,
      parent: ''
    }) as GraphQLNamedOutputType
    const isRootType = definition.parents.length === 0
    if (isRootType) {
      const objectType = type as GraphQLObjectType
      const config = objectType.toConfig()
      types.push(
        new GraphQLObjectType({
          ...config,
          fields: {
            ...Builtins.Entry.toConfig().fields,
            ...config.fields
          },
          interfaces: [Builtins.Entry]
        })
      )
    } else {
      types.push(type)
    }
  }
  return new GraphQLSchema({query: Builtins.Query, types})
}

type Context = {
  types: Map<string, GraphQLOutputType>
  parent: string
}

function nameType(
  types: Map<string, GraphQLOutputType>,
  name: string,
  create: () => GraphQLOutputType
) {
  if (types.has(name)) return types.get(name)!
  const type = create()
  types.set(name, type)
  return type
}

export function graphQLTypeOf(
  hint: Hint,
  context: Context = {
    types: new Map<string, GraphQLOutputType>(),
    parent: ''
  }
): GraphQLOutputType {
  switch (hint.type) {
    case 'literal':
    case 'string':
      return GraphQLString
    case 'number':
      return GraphQLFloat
    case 'boolean':
      return GraphQLBoolean
    case 'array':
      return new GraphQLList(graphQLTypeOf(hint.inner, context))
    case 'object': {
      const name = context.parent
      return nameType(
        context.types,
        name,
        () =>
          new GraphQLObjectType({
            name,
            fields: Object.fromEntries(
              Object.entries(hint.fields).map(([key, value]) => {
                return [
                  key,
                  {
                    type: graphQLTypeOf(value, {
                      types: context.types,
                      parent: context.parent + '_' + key
                    })
                  }
                ]
              })
            )
          })
      )
    }
    case 'definition': {
      const name = hint.name
      return nameType(
        context.types,
        name,
        () =>
          new GraphQLObjectType({
            name,
            fields: Object.fromEntries(
              Object.entries(hint.fields).map(([key, value]) => {
                return [
                  key,
                  {
                    type: graphQLTypeOf(value, {
                      types: context.types,
                      parent: name + '_' + key
                    })
                  }
                ]
              })
            )
          })
      )
    }
    case 'union': {
      if (hint.options.length === 1)
        return graphQLTypeOf(hint.options[0], context)
      const name = context.parent
      const types = hint.options.map(
        option =>
          graphQLTypeOf(option, {
            ...context,
            parent: name + '_'
          }) as GraphQLObjectType
      )
      if (new Set(types).size === 1) return types[0]
      return nameType(
        context.types,
        name,
        () =>
          new GraphQLUnionType({
            name: context.parent,
            types
          })
      )
    }
    case 'extern': {
      const name = hint.from.name
      return nameType(
        context.types,
        name,
        () => new GraphQLInterfaceType({name, fields: {}})
      )
    }
    case 'intersection': {
      // We can deal with exactly one scenario:
      // an object type extending an interface
      const [a, b] = hint.options
      return graphQLTypeOf(a, context)
      /*if (a?.type === 'extern' && b?.type === 'object') {
        const name = context.parent
        return nameType(
          context.types,
          name,
          () =>
            new GraphQLObjectType({
              name,
              interfaces: [graphQLTypeOf(a, context) as GraphQLInterfaceType],
              fields: Object.fromEntries(
                Object.entries(b.fields).map(([key, value]) => {
                  return [
                    key,
                    {
                      type: graphQLTypeOf(value, {
                        types: context.types,
                        parent: name + '_' + key
                      })
                    }
                  ]
                })
              )
            })
        )
      }*/
      throw createError(
        `Cannot generate GraphQL type for intersection: ${hint}`
      )
    }
  }
}
