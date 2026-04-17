import {Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {TabsSection} from '#/field/tabs.js'
import {EditFields} from '../../Editor.js'
import {Surface, SurfaceContent, SurfaceHeader} from '../../ui/Surface.js'

interface TabsViewProps {
  section: Section
}

export function TabsView({section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  return (
    <Surface>
      <Tabs>
        <SurfaceHeader>
          <TabList>
            {visibleTypes.map((type, i) => (
              <Tab key={i} id={i}>
                {Type.label(type)}
              </Tab>
            ))}
          </TabList>
        </SurfaceHeader>
        <SurfaceContent>
          {visibleTypes.map((type, i) => (
            <TabPanel key={i} id={i}>
              <EditFields fields={getType(type).fields} />
            </TabPanel>
          ))}
        </SurfaceContent>
      </Tabs>
    </Surface>
  )
}
