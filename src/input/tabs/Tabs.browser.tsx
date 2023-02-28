import {Section} from 'alinea/core'
import {InputForm, InputState} from 'alinea/editor'
import {HStack, Tabs, TextLabel} from 'alinea/ui'
import {tabs as createTabs, TabsSection} from './Tabs.js'

export * from './Tabs.js'

export const tabs = Section.withView(createTabs, TabsView)

type TabsViewProps = {
  state: InputState<any>
  section: TabsSection<any>
}

function TabsView({state, section}: TabsViewProps) {
  const visibleTypes = section.types.filter(type => !type.options?.isHidden)
  if (!visibleTypes.length) return null

  return (
    <Tabs.Root>
      <Tabs.List>
        {visibleTypes.map((type, i) => {
          const Icon = type.options?.icon
          return (
            <Tabs.Trigger key={i}>
              <HStack center gap={8}>
                {/*Icon && <Icon />*/}
                <TextLabel label={type.label} />
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
