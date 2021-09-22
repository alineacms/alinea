import {fromModule} from '@alinea/ui/styler'
import React from 'react'
import {RiFlashlightFill} from 'react-icons/ri'
import {Logo} from '../branding/Logo'
import css from './Toolbar.module.scss'
import {HStack} from '@alinea/ui/Stack'

const styles = fromModule(css)

export function Toolbar() {
  return (
    <div className={styles.root()}>
      <Logo>
        <RiFlashlightFill />
      </Logo>
    </div>
  )
}
