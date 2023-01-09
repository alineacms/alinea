import {createGraphQLSchema} from '@alinea/backend/graphql/CreateGraphQLSchema'
import {createError} from '@alinea/core/ErrorWithCode'
import {Schema} from '@alinea/core/Schema'
import {code} from '@alinea/core/util/CodeGen'
import {
  GraphQLFieldMap,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  printSchema,
  validateSchema
} from 'graphql'

export function generateGraphQL(schema: Schema) {
  const graphqlSchema = createGraphQLSchema(schema)
  const errors = validateSchema(graphqlSchema)
  if (errors.length > 0)
    throw createError(
      code`
    > Alinea tried to generate a GraphQL schema, but it is invalid:
      - ${errors.map(e => e.toString()).join('\n- ')}
  `.toString()
    )
  const res = code(printSchema(graphqlSchema))
  for (const type of Object.values(graphqlSchema.getTypeMap())) {
    if (
      type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType
    ) {
      const filled = fillFields(type.getFields())
      if (filled.length > 0)
        res.push(code`
          fragment ${type.name} on ${type.name} {
            ${filled.join('\n')}
          }
        `)
    }
  }
  return res.toString()
}

function fillFields(fields: GraphQLFieldMap<any, any>) {
  return Object.entries(fields)
    .map(([key, field]) => {
      if (field.type instanceof GraphQLScalarType) return key
      if (
        field.type instanceof GraphQLObjectType ||
        field.type instanceof GraphQLInterfaceType
      )
        return code`
        ${key} {
          ...${field.type.name}
        }
      `.toString()
    })
    .filter(Boolean) as Array<string>
}
