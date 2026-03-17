import {Tab, TabList, TabPanel, Tabs} from '@alinea/components'
import {getType} from 'alinea/core/Internal.js'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {TabsSection} from 'alinea/field/tabs'
import {EditFields} from '../Editor.js'

interface TabsViewProps {
  section: Section
}

export function TabsView({section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  return (
    <Tabs variant="subtle">
      <TabList>
        {visibleTypes.map((type, i) => (
          <Tab key={i} id={i}>
            {Type.label(type)}
          </Tab>
        ))}
      </TabList>
      {visibleTypes.map((type, i) => (
        <TabPanel key={i} id={i}>
          <EditFields fields={getType(type).fields} />
        </TabPanel>
      ))}
    </Tabs>
  )
}
