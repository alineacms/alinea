import {describe, expect, test} from 'bun:test'
import {
  mutationsFromReplicaCommands,
  parseReplicaCommands,
  replicaCommandsFromMutations
} from './Commands.js'

describe('replica commands', () => {
  test('round trips the structural write contract', () => {
    const mutations = [
      {
        op: 'create' as const,
        id: 'entry-1',
        type: 'Page',
        locale: null,
        data: {title: 'Page'}
      },
      {
        op: 'move' as const,
        id: 'entry-1',
        target: 'pages',
        targetType: 'root' as const,
        dropPosition: 'on' as const
      }
    ]
    expect(
      mutationsFromReplicaCommands(
        parseReplicaCommands(replicaCommandsFromMutations(mutations))
      )
    ).toEqual(mutations)
  })

  test('rejects malformed commands', () => {
    expect(() => parseReplicaCommands([{kind: 'moveEntry'}])).toThrow(
      'Expected replica commands'
    )
  })
})
