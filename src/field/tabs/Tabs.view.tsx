import {
  Icon,
  Surface,
  SurfaceContent,
  SurfaceHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {EditFields} from '#/dashboard/app/EntryFields.js'
import {TabsSection} from '#/field/tabs.js'
import {ViewSection} from '#/field/view.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {useOptionalDashboardContext} from '#/dashboard/hooks.js'
import {useState} from 'react'

interface TabsViewProps {
  section: Section
}

export function TabsView({section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  // A link to a submission opens the tab with the submissions of the form
  const submission = useOptionalDashboardContext()?.page.submission
  const index = visibleTypes.findIndex(holdsSubmissions)
  const linked = submission && index >= 0 ? String(index) : undefined
  const [tab, setTab] = useState(linked ?? '0')
  const [requested, setRequested] = useState(submission)
  if (submission !== requested) {
    setRequested(submission)
    if (linked) setTab(linked)
  }
  if (!visibleTypes.length) return null
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <Surface>
        <SurfaceHeader>
          <TabsList>
            {visibleTypes.map((type, i) => {
              const {icon} = getType(type)
              return (
                <TabsTrigger key={i} value={String(i)}>
                  {icon && <Icon icon={icon} />}
                  {Type.label(type)}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </SurfaceHeader>
        <SurfaceContent>
          {visibleTypes.map((type, i) => (
            <TabsContent key={i} value={String(i)}>
              <EditFields fields={getType(type).fields} />
            </TabsContent>
          ))}
        </SurfaceContent>
      </Surface>
    </Tabs>
  )
}

function holdsSubmissions(type: Type): boolean {
  return Type.sections(type).some(section => {
    const data = section[Section.Data]
    return data instanceof ViewSection && data.view === viewKeys.FormSubmissions
  })
}
