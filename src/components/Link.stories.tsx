import {Stack} from '../stories/Stack.tsx'
import {Link} from './Link.tsx'

export const Variants = () => (
  <Stack>
    <Link href="https://google.com" target="_blank">
      Default link (plain)
    </Link>
    <Link href="https://google.com" target="_blank" variant="underline">
      Underline link
    </Link>
  </Stack>
)

export default {
  title: 'Components / Link'
}
