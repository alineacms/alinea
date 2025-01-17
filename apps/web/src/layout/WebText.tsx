import styler from '@alinea/styler'
import {RichText, RichTextProps} from 'alinea/ui/RichText'
import reactStringReplace from 'react-string-replace'
import css from './WebText.module.scss'
import {WebTypo} from './WebTypo'

const styles = styler(css)

function Text({children}: {children: string}) {
  return reactStringReplace(children, /\`(.+?)\`/g, (match, i) => (
    <span className={styles.code()} key={i}>
      {match}
    </span>
  ))
}

export function WebText<T extends {}>(props: RichTextProps<T>) {
  return (
    <div className={styles.root()}>
      <RichText
        text={Text}
        p={WebTypo.P}
        h1={WebTypo.H1}
        h2={WebTypo.H2}
        h3={WebTypo.H3}
        h4={WebTypo.H4}
        a={WebTypo.Link}
        ul={<ul className={styles.list()} />}
        ol={<ol className={styles.list()} />}
        li={<li className={styles.listItem()} />}
        blockquote={<blockquote className={styles.blockquote()} />}
        {...props}
      />
    </div>
  )
}
