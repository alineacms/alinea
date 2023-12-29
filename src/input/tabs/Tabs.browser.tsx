import {Section, Type} from 'alinea/core'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {InputLabel} from 'alinea/editor'
import {HStack, TextLabel} from 'alinea/ui'
import {Lift} from 'alinea/ui/Lift'
import {Sink} from 'alinea/ui/Sink'
import {Tabs} from 'alinea/ui/Tabs'
import {useElevation} from 'alinea/ui/util/Elevation'
import {TabsSection, tabs as createTabs} from './Tabs.js'

export * from './Tabs.js'

// Todo: fix type here
export const tabs = Section.provideView(TabsView, createTabs as any)

interface TabsViewProps {
  section: Section
}

export interface TabsHeaderProps {
  section: Section
  backdrop?: boolean
}

export function TabsHeader({section, backdrop}: TabsHeaderProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.meta(type).isHidden)
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

function TabsView({section}: TabsViewProps) {
  const {parent} = useElevation()
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.meta(type).isHidden)
  if (!visibleTypes.length) return null
  const inner = (
    <Tabs.Root>
      <TabsHeader section={section} />
      <Lift>
        <Tabs.Panels>
          {visibleTypes.map((type, i) => {
            return (
              <Tabs.Panel key={i} tabIndex={i}>
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
