import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, TextLabel} from 'alinea/ui'
import {Lift} from 'alinea/ui/Lift'
import {Sink} from 'alinea/ui/Sink'
import {Tabs} from 'alinea/ui/Tabs'
import {useElevation} from 'alinea/ui/util/Elevation'
import {TabsSection} from './Tabs.js'

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
        const meta = Type.meta(type)
        const Icon = meta.icon
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
