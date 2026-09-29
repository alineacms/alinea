import {useState} from 'react'
import {
  IcBaselineAccountCircle,
  IcOutlineSettings,
  IcRoundCheck,
  LucideFile,
  LucideImage
} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {
  NavRail,
  NavRailContent,
  NavRailFooter,
  NavRailHeader,
  NavRailItem
} from './NavRail.js'
import {Tooltip, TooltipContent, TooltipTrigger} from './Tooltip.js'

const sections = [
  {id: 'pages', label: 'Pages', icon: LucideFile},
  {id: 'media', label: 'Media', icon: LucideImage, badge: 3},
  {id: 'settings', label: 'Settings', icon: IcOutlineSettings, badge: true}
]

export function Example() {
  const [active, setActive] = useState('pages')
  return (
    <div
      style={{
        display: 'flex',
        height: 480,
        padding: 8,
        background: 'var(--alinea-backdrop)'
      }}
    >
      <NavRail aria-label="Sections">
        <NavRailHeader>
          <span
            aria-hidden
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'var(--alinea-primary)',
              color: 'var(--alinea-primary-fg)',
              fontWeight: 700
            }}
          >
            a
          </span>
        </NavRailHeader>
        <NavRailContent>
          {sections.map(section => (
            <NavRailItem
              key={section.id}
              icon={section.icon}
              label={section.label}
              badge={section.badge}
              active={active === section.id}
              onClick={() => setActive(section.id)}
            />
          ))}
          <NavRailItem icon={LucideFile} label="Documentation" href="#docs" />
          <NavRailItem icon={IcRoundCheck} label="Archive" disabled />
        </NavRailContent>
        <NavRailFooter>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                icon={IcBaselineAccountCircle}
                aria-label="Profile"
              />
            </TooltipTrigger>
            <TooltipContent side="right">Profile</TooltipContent>
          </Tooltip>
        </NavRailFooter>
      </NavRail>
    </div>
  )
}

export default {
  title: 'Pure components / NavRail'
}
