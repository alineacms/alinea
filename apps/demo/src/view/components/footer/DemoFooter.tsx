import {fromModule} from '@alinea/ui'
import {DemoContainer} from '../../layout/DemoContainer'
import css from './DemoFooter.module.scss'

const styles = fromModule(css)

export function DemoFooter() {
  return (
    <div className={styles.root()}>
      <DemoContainer>
        <p>© 2022 - All rights reserved</p>
      </DemoContainer>
    </div>
  )
}
