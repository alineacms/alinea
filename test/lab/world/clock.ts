import {realmChannel} from '../shared/protocol.js'
import {bus} from './bus.js'

/**
 * The lab clock runs with real time and can jump ahead. Every realm reads it
 * through `Date.now`, and runs the timers it passed.
 */
class LabClock {
  offset = 0
  #realms = new Set<string>()

  now() {
    return Date.now() + this.offset
  }

  register(realm: string) {
    this.#realms.add(realm)
  }

  unregister(realm: string) {
    this.#realms.delete(realm)
  }

  advance(ms: number) {
    this.offset += ms
    for (const realm of this.#realms) {
      const channel = new BroadcastChannel(realmChannel(realm))
      channel.postMessage({type: 'clock', offset: this.offset})
      channel.close()
    }
    bus.log({
      node: 'clock',
      kind: 'clock',
      text: `⏩ time jumps ${Math.round(ms / 1000)}s ahead`
    })
  }
}

export const clock = new LabClock()

bus.now = () => clock.now()
