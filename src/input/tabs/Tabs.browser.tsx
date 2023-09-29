import {Section, Type} from 'alinea/core'
import {InputForm, InputLabel, InputState} from 'alinea/editor'
import {HStack, Sink, TextLabel} from 'alinea/ui'
import {Lift, useLiftLevel} from 'alinea/ui/Lift'
import {Tabs} from 'alinea/ui/Tabs'
import {TabsSection, tabs as createTabs} from './Tabs.js'

export * from './Tabs.js'

export const tabs = Section.provideView(TabsView, createTabs)

interface TabsViewProps {
  state: InputState<any>
  section: Section
}

function TabsView({state, section}: TabsViewProps) {
  const level = useLiftLevel()
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.meta(type).isHidden)
  if (!visibleTypes.length) return null
  const inner = (
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
      <Lift>
        <Tabs.Panels>
          {visibleTypes.map((type, i) => {
            return (
              <Tabs.Panel key={i} tabIndex={i}>
                <InputForm type={type} state={state} border={false} />
              </Tabs.Panel>
            )
          })}
        </Tabs.Panels>
      </Lift>
    </Tabs.Root>
  )
  return (
    <div>
      {level > 0 ? (
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
