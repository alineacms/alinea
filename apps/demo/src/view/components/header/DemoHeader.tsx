import {fromModule} from '@alinea/ui'
import Logo from '../../../../public/logo.svg'
import {DemoContainer} from '../../layout/DemoContainer'
import css from './DemoHeader.module.scss'

const styles = fromModule(css)

export function DemoHeader() {
  return (
    <div className={styles.root()}>
      <DemoContainer>
        <div className={styles.root.row()}>
          <HeaderLogo />
          <p>Navigation</p>
        </div>
      </DemoContainer>
    </div>
  )
}

function HeaderLogo() {
  return (
    <div className={styles.logo()}>
      <Logo />
    </div>
  )
}
