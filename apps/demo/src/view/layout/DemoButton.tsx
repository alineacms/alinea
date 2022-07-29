import {HTMLProps} from 'react'

import {fromModule, Variant} from '@alinea/ui'
import css from './DemoButton.module.scss'
import {DemoLink} from './DemoLink'

const styles = fromModule(css)

type ButtonProps = (
  | Omit<HTMLProps<HTMLAnchorElement>, 'as'>
  | ({as: 'a'} & HTMLProps<HTMLAnchorElement>)
  | ({as: 'button'} & HTMLProps<HTMLButtonElement>)
) & {
  to?: string
  mod?: Variant<'outline'>
}

export function DemoButton({children, mod, ...props}: ButtonProps) {
  let ButtonTag: any = DemoLink
  if ('as' in props && props.as === 'button') ButtonTag = 'button'

  return (
    <ButtonTag {...props} className={styles.root(mod)}>
      {children}
    </ButtonTag>
  )
}
