import {Breadcrumb, Breadcrumbs} from '#/components/Breadcrumbs.js'
import {styler} from '@alinea/styler'
import {IcRoundRemoveRedEye} from '../icons.js'
import {Badge} from './Badge.js'
import css from './DetailsBar.module.css'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

interface DetailsBarProps {
  status: 'published' | 'unpublished' | 'draft' | 'archived'
}

export function DetailsBar({status}: DetailsBarProps) {
  return (
    <RailHeader className={styles.DetailsBar()} data-status={status}>
      <Breadcrumbs>
        <Breadcrumb>
          <a>Pages</a>
        </Breadcrumb>
        <Breadcrumb>
          <a>Parent</a>
        </Breadcrumb>
      </Breadcrumbs>
      <Badge icon={IcRoundRemoveRedEye} appearance="plain">
        Published
      </Badge>
    </RailHeader>
  )
}
