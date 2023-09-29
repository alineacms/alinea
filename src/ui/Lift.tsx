import {fromModule} from 'alinea/ui'
import {HTMLProps, createContext, useContext} from 'react'
import css from './Lift.module.scss'

const styles = fromModule(css)

const liftLevel = createContext(0)
export const useLiftLevel = () => useContext(liftLevel)

export function Lift(props: HTMLProps<HTMLDivElement>) {
  const level = useLiftLevel()
  return (
    <liftLevel.Provider value={level + 1}>
      <div {...props} className={styles.root.mergeProps(props)()} />
    </liftLevel.Provider>
  )
}

export function LiftHeader(props: HTMLProps<HTMLDivElement>) {
  return <header {...props} className={styles.header.mergeProps(props)()} />
}
