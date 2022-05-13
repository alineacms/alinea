import {InputForm, InputState} from '@alinea/editor'
import {fromModule, HStack, Tabs, TextLabel} from '@alinea/ui'
import {TabsSection} from './TabsSection'
import css from './TabsView.module.scss'

const styles = fromModule(css)

export type TabsViewProps = {
  state: InputState<any>
  section: TabsSection<any>
}

export function TabsView({state, section}: TabsViewProps) {
  return (
    <Tabs.Root>
      <Tabs.List>
        {section.types.map((type, i) => {
          const Icon = type.options?.icon
          return (
            <Tabs.Trigger key={i}>
              <HStack center gap={8}>
                {Icon && <Icon />}
                <TextLabel label={type.label} />
              </HStack>
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>
      <Tabs.Panels>
        {section.types.map((type, i) => {
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
