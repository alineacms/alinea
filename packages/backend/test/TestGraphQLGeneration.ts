import {
  createGraphQLSchema,
  graphQLTypeOf
} from '@alinea/backend/graphql/CreateGraphQLSchema'

import {Hint, schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {list} from '@alinea/input.list'
import {object} from '@alinea/input.object'
import {text} from '@alinea/input.text'
import {GraphQLString} from 'graphql'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('string type', () => {
  const string = Hint.String()
  const stringType = graphQLTypeOf(string)
  assert.is(stringType, GraphQLString)

  createGraphQLSchema(
    schema({
      TypeA: type('Type A', {
        title: text('Title'),
        listField: list('List field', {
          schema: schema({
            Block1: type('Block 1', {
              blockField1: text('Block field 1'),
              link: link.entry('Link')
            }),
            Block2: type('Block 2', {
              blockField1: text('Block field 2'),
              link: link.entry('Link'),
              obj: object('Object field', {
                fields: type('Fields', {
                  field1: text('Field 1')
                })
              })
            })
          })
        })
      })
    })
  )
})

test.run()
