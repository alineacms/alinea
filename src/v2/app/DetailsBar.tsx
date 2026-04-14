import { Breadcrumb, Breadcrumbs } from 'react-aria-components'
// import { IcRoundRemoveRedEye } from '../stories/icons/IcRoundRemoveRedEye.tsx'
// import { Breadcrumbs } from '../todo/Breadcrumbs.tsx'
// import { Badge } from './Badge.tsx'
import { IcRoundRemoveRedEye } from '../icons'
import { Badge } from './Badge'
import './DetailsBar.css'
// import { Link } from './Link.tsx'

interface DetailsBarProps {
  status: 'published' | 'draft' | 'archived'
}

export function DetailsBar({status}: DetailsBarProps) {
  return (
    <div className="alinea-rac-DetailsBar" data-status={status}>
      <Breadcrumbs>
        <Breadcrumb>
          <a>Pages</a>
        </Breadcrumb>
        <Breadcrumb>
          <a>Parent</a>
        </Breadcrumb>
      </Breadcrumbs>
      <Badge
        icon={<IcRoundRemoveRedEye />}
        label="Published"
        status="success"
        appearence="plain"
      />
    </div>
  )
}
