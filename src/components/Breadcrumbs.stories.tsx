import {Breadcrumb, Link} from 'react-aria-components'
import {Breadcrumbs} from './Breadcrumbs.js'

export const Example = (args: any) => (
  <Breadcrumbs {...args}>
    <Breadcrumb>
      <Link href="/">Home</Link>
    </Breadcrumb>
    <Breadcrumb>
      <Link href="/react-aria/">React Aria</Link>
    </Breadcrumb>
    <Breadcrumb>
      <Link>Breadcrumbs</Link>
    </Breadcrumb>
  </Breadcrumbs>
)

export default {title: 'Components / Breadcrumbs'}
