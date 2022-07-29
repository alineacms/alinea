import React, {HTMLProps} from 'react'

import {fromModule, Variant} from '@alinea/ui'
import css from './DemoTitle.module.scss'
const styles = fromModule(css)

type Heading = React.FC<
  HTMLProps<HTMLHeadingElement> & {as?: any; mod?: HeadingMods}
>
type HeadingMods = Variant<'inherit'>

const H1: Heading = ({as: Tag = 'h1', mod, ...props}) => (
  <Tag {...props} className={styles.root.mergeProps(props)('h1', mod)} />
)
const H2: Heading = ({as: Tag = 'h2', mod, ...props}) => (
  <Tag {...props} className={styles.root.mergeProps(props)('h2', mod)} />
)
const H3: Heading = ({as: Tag = 'h3', mod, ...props}) => (
  <Tag {...props} className={styles.root.mergeProps(props)('h3', mod)} />
)

export const DemoTitle = {H1, H2, H3}
