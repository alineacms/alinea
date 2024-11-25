import styler from '@alinea/styler'
import {HStack, px} from 'alinea/ui'
import {ComponentType, HTMLProps, PropsWithChildren} from 'react'
import css from './Features.module.scss'

const styles = styler(css)

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
      <div className={styles.feature.inner()}>{children}</div>
    </div>
  )
}

interface FeatureTitleProps {
  icon?: ComponentType<{className?: string}>
}

export namespace Feature {
  export function Title({
    children,
    icon: Icon
  }: PropsWithChildren<FeatureTitleProps>) {
    return (
      <HStack center gap={16} style={{paddingBottom: px(8)}}>
        {Icon && <Icon className={styles.feature.icon()} />}
        <h2 className={styles.feature.title()}>{children}</h2>
      </HStack>
    )
  }
}
