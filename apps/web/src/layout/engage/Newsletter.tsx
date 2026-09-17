import styler from '@alinea/styler'
import {VStack} from 'alinea/ui/Stack'
import {HTMLProps} from 'react'
import {Action} from '../Action'
import {WebTypo} from '../WebTypo'
import css from './Newsletter.module.scss'

const styles = styler(css)

export function Newsletter(props: HTMLProps<HTMLFormElement>) {
  return (
    <form
      action="https://codeurs.us7.list-manage.com/subscribe/post?u=8e413112334fb79c0ae78c1da&amp;id=9be892ae30&amp;f_id=00a8efe3f0"
      method="post"
      target="_blank"
      {...props}
    >
      <VStack gap={12} align="flex-start">
        <WebTypo.P flat>
          Receive important updates <br />
          in your inbox. No spam.
        </WebTypo.P>
        <input
          placeholder="Email address"
          type="email"
          name="EMAIL"
          required
          className={styles.root.email()}
        />
        <Action size={14}>
          <button>Sign up</button>
        </Action>
      </VStack>
    </form>
  )
}
