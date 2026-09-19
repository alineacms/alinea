import {Disclosure, DisclosureHeader, DisclosurePanel} from '#/components.js'
import {Section, type Section as CoreSection} from '#/core/Section.js'
import {
  EditFields,
  useInitiallyExpandDisclosures
} from '#/dashboard/app/EntryFields.js'
import {DisclosureSection} from '#/field/disclosure.js'

interface DisclosureViewProps {
  section: CoreSection
}

export function DisclosureView({section}: DisclosureViewProps) {
  const disclosure = section[Section.Data] as DisclosureSection
  const initiallyExpandDisclosures = useInitiallyExpandDisclosures()
  return (
    <Disclosure
      appearance="field"
      defaultExpanded={
        disclosure.initiallyExpanded || initiallyExpandDisclosures
      }
    >
      <DisclosureHeader chevronPosition="end">
        {disclosure.label}
      </DisclosureHeader>
      <DisclosurePanel>
        <EditFields fields={disclosure.definition} />
      </DisclosurePanel>
    </Disclosure>
  )
}
