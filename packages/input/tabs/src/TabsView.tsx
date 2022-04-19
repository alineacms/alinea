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
    <Tabs.Root defaultValue={'0'}>
      <Tabs.List>
        {section.types.map((type, i) => {
          const Icon = type.options?.icon
          return (
            <Tabs.Trigger key={i} value={String(i)}>
              <HStack center gap={8}>
                {Icon && <Icon />}
                <TextLabel label={type.label} />
              </HStack>
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>
      {section.types.map((type, i) => {
        return (
          <Tabs.Content key={i} value={String(i)} tabIndex={i}>
            <InputForm type={type} state={state} />
          </Tabs.Content>
        )
      })}
    </Tabs.Root>
  )
}
