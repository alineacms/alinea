import {fromModule} from '@alinea/ui'
import {PropsWithChildren, useState} from 'react'
import {usePaneIndex} from '../hook/UsePaneIndex'
import css from './PaneControl.module.scss'

const styles = fromModule(css)

export type PaneControlProps = PropsWithChildren<{
  position: number
  mod?: {
    [s: string]: boolean
  }
  lastPane?: boolean
}>

export function PaneControl({
  children,
  position,
  mod,
  lastPane
}: PaneControlProps) {
  const paneIndex = usePaneIndex()
  const mods: {[s: string]: boolean} = mod || {}
  const [touchStart, setTouchStart] = useState<number>(0)
  if (position === paneIndex?.index) {
    mods.show = true
  }
  if (paneIndex?.index && position < paneIndex?.index) {
    mods.lhide = true
  }
  if (paneIndex?.index || paneIndex?.index === 0) {
    if (position > paneIndex.index) {
      mods.rhide = true
    }
  }
  switch (position) {
    case 0:
      mods.lside = true
      break
    case 1:
      mods.center = true
      break
    case 2:
      mods.rside = true
  }
  return (
    <div
      onTouchStart={e => {
        setTouchStart(e.changedTouches[0].screenX)
      }}
      onTouchEnd={e => {
        const pIndex = paneIndex?.index
        const touchEnd = e.changedTouches[0].screenX
        if (pIndex !== position) {
          e.preventDefault()
          paneIndex?.setIndex(position)
          return
        }
        const distance = touchStart - touchEnd
        // Left swipe
        if (distance < -50 && pIndex > 0) {
          e.preventDefault()
          paneIndex?.setIndex(pIndex - 1)
          return
        }
        // Right swipe
        if (distance > 50 && pIndex < 2 && !lastPane) {
          e.preventDefault()
          paneIndex?.setIndex(pIndex + 1)
          return
        }
      }}
      className={styles.root(mods)}
    >
      <div
        className={styles.overlay(mods)}
        onClick={() => paneIndex?.setIndex(1)}
      ></div>
      {children}
    </div>
  )
}
