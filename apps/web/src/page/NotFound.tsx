import styler from '@alinea/styler'
import {Button} from '@/layout/Button'
import WebLayout from '@/layout/WebLayout'
import css from './NotFound.module.scss'

const styles = styler(css)

export default async function NotFound() {
  return (
    <WebLayout>
      <main className={styles.root()}>
        <h1 className={styles.root.title()}>Page Not Found</h1>
        <p className={styles.root.description()}>
          The page you were looking for does not exist.
        </p>
        <Button href="/" className={styles.root.action()}>
          Back to home
        </Button>
      </main>
    </WebLayout>
  )
}
