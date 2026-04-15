import {getType} from '#/core/Internal.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {InputForm} from '#/dashboard/editor/InputForm.js'
import {InputLabel} from '#/dashboard/view/InputLabel.js'
import {HStack, TextLabel} from '#/ui.js'
import {Lift} from '#/ui/Lift.js'
import {Sink} from '#/ui/Sink.js'
import {Tabs} from '#/ui/Tabs.js'
import {useElevation} from '#/ui/util/Elevation.js'
import type {TabsSection} from './Tabs.js'

interface TabsViewProps {
  section: Section
}

export interface TabsHeaderProps {
  section: Section
  backdrop?: boolean
}

export function TabsHeader({section, backdrop}: TabsHeaderProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  return (
    <Tabs.List backdrop={backdrop}>
      {visibleTypes.map((type, i) => {
        const {icon: Icon} = getType(type)
        return (
          <Tabs.Trigger key={i}>
            <HStack center gap={8}>
              {Icon && <Icon />}
              <TextLabel label={Type.label(type)} />
            </HStack>
          </Tabs.Trigger>
        )
      })}
    </Tabs.List>
  )
}

export function TabsView({section}: TabsViewProps) {
  const {parent} = useElevation()
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  const inner = (
    <Tabs.Root>
      <TabsHeader section={section} />
      <Lift>
        <Tabs.Panels>
          {visibleTypes.map((type, i) => {
            return (
              <Tabs.Panel unmount={false} key={i} tabIndex={i}>
                <InputForm type={type} border={false} />
              </Tabs.Panel>
            )
          })}
        </Tabs.Panels>
      </Lift>
    </Tabs.Root>
  )
  return (
    <div>
      {parent === 'lift' ? (
        <InputLabel inline>
          <Sink.Root>
            <Sink.Content>{inner}</Sink.Content>
          </Sink.Root>
        </InputLabel>
      ) : (
        inner
      )}
    </div>
  )
}
