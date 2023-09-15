import {Section, Type} from 'alinea/core'
import {InputForm, InputState} from 'alinea/editor'
import {HStack, TextLabel} from 'alinea/ui'
import {Tabs} from 'alinea/ui/Tabs'
import {TabsSection, tabs as createTabs} from './Tabs.js'

export * from './Tabs.js'

export const tabs = Section.provideView(TabsView, createTabs)

interface TabsViewProps {
  state: InputState<any>
  section: Section
}

function TabsView({state, section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.meta(type).isHidden)
  if (!visibleTypes.length) return null
  return (
    <Tabs.Root>
      <Tabs.List>
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
      <Tabs.Panels>
        {visibleTypes.map((type, i) => {
          return (
            <Tabs.Panel key={i} tabIndex={i}>
              <InputForm type={type} state={state} />
            </Tabs.Panel>
          )
        })}
      </Tabs.Panels>
    </Tabs.Root>
  )
}
