import {fromModule, RichText, RichTextProps} from 'alinea/ui'
import css from './DemoText.module.scss'
import {DemoTypo} from './DemoType'

const styles = fromModule(css)

export function DemoText<T>(props: RichTextProps<T>) {
  return (
    <div className={styles.root()}>
      <RichText
        p={DemoTypo.P}
        h1={DemoTypo.H1}
        h2={DemoTypo.H2}
        h3={DemoTypo.H3}
        h4={DemoTypo.H4}
        a={<DemoTypo.Link target="_blank" />}
        ul={<ul className={styles.list()} />}
        ol={<ol className={styles.list()} />}
        li={<li className={styles.listItem()} />}
        {...props}
      />
    </div>
  )
}
