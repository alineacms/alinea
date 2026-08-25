import {describe, expect, test} from 'bun:test'
import {ReplicaRevisionLog} from './Deltas.js'

describe('ReplicaRevisionLog', () => {
  test('orders lightweight revision notifications', () => {
    const log = new ReplicaRevisionLog()
    const received: Array<string> = []
    const unsubscribe = log.subscribe(event => received.push(event.revision))
    log.publish('tree-1')
    log.publish('tree-2')
    unsubscribe()
    log.publish('tree-3')

    expect(received).toEqual(['tree-1', 'tree-2'])
    expect(log.after(1)).toEqual({
      reset: false,
      events: [
        {sequence: 2, revision: 'tree-2'},
        {sequence: 3, revision: 'tree-3'}
      ]
    })
  })

  test('requests a state reset after retained history is exceeded', () => {
    const log = new ReplicaRevisionLog(2)
    log.publish('tree-1')
    log.publish('tree-2')
    log.publish('tree-3')

    expect(log.after(0)).toEqual({reset: true, events: []})
    expect(log.after(1).events.map(event => event.revision)).toEqual([
      'tree-2',
      'tree-3'
    ])
  })
})
