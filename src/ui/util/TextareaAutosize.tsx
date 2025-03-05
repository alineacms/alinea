import styler from '@alinea/styler'
import {HTMLProps} from 'react'
import css from './TextareaAutosize.module.scss'

const styles = styler(css)

export function TextareaAutosize(props: HTMLProps<HTMLTextAreaElement>) {
  return (
    <div className={styles.root()}>
      <textarea
        {...props}
        className={styles.root.textarea.mergeProps(props)()}
        rows={1}
      />
      <div
        aria-hidden="true"
        className={styles.root.shadow.mergeProps(props)()}
      >
        {(props.value || props.placeholder) + ' '}
      </div>
    </div>
  )
}
