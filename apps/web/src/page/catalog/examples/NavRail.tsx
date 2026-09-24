'use client'

import {
  NavRail,
  NavRailContent,
  NavRailFooter,
  NavRailItem
} from 'alinea/components'
import {
  IcBaselineAccountCircle,
  IcOutlineSettings,
  LucideFile,
  LucideImage
} from 'alinea/dashboard/icons'

export function NavRailExample() {
  return (
    <div style={{display: 'flex', height: 240}}>
      <NavRail aria-label="Sections">
        <NavRailContent>
          <NavRailItem icon={LucideFile} label="Pages" active />
          <NavRailItem icon={LucideImage} label="Media" badge={3} />
          <NavRailItem icon={IcOutlineSettings} label="Settings" />
        </NavRailContent>
        <NavRailFooter>
          <NavRailItem icon={IcBaselineAccountCircle} label="Maya Janssens" />
        </NavRailFooter>
      </NavRail>
    </div>
  )
}
