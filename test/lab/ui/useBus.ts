import {useSyncExternalStore} from 'react'
import {bus} from '../world/bus.js'

/** Render again whenever the lab changes. */
export function useBus() {
  useSyncExternalStore(bus.subscribe, bus.getVersion)
  return bus
}
