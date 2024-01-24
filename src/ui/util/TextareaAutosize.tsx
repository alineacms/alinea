import {HTMLProps} from 'react'
import {fromModule} from './Styler.js'
import css from './TextareaAutosize.module.scss'

const styles = fromModule(css)

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
