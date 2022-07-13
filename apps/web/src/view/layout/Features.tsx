import {fromModule} from '@alinea/ui'
import {ComponentType, HTMLProps, PropsWithChildren} from 'react'
import css from './Features.module.scss'

const styles = fromModule(css)

export function Features({
  children,
  ...props
}: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
  return (
    <div {...props} className={styles.features.mergeProps(props)()}>
      {children}
    </div>
  )
}

export type FeatureProps = PropsWithChildren<{
  icon?: ComponentType<{className?: string}>
}>

export function Feature({icon: Icon, children}: FeatureProps) {
  return (
    <div className={styles.feature()}>
      {Icon && <Icon className={styles.feature.icon()} />}
      {children}
    </div>
  )
}

export namespace Feature {
  export function Title({children}: PropsWithChildren<{}>) {
    return <h2 className={styles.feature.title()}>{children}</h2>
  }
}
