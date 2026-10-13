import type {OverviewEntry} from './Overview.js'

/** The entry a dashboard view renders for, eg. the entry being edited */
export interface DashboardEntry<Data = Record<string, unknown>>
  extends OverviewEntry {
  /**
   * The field values of the selected version as saved. Unsaved edits are not
   * included: read the live value of a field with `useFieldValue(field)`.
   */
  data: Data
}
