import {Link} from './Link.js'

export const Variants = () => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
    <Link href="https://google.com" target="_blank">
      Default link (plain)
    </Link>
    <Link href="https://google.com" target="_blank" variant="underline">
      Underline link
    </Link>
  </div>
)

export default {
  title: 'Components / Link'
}
