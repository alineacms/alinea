/**
 * The handler runs another config than this dashboard, as after a deploy: a
 * reload loads the dashboard that matches it.
 */
export class VersionEvent extends Event {
  static readonly type = 'version'

  constructor(public outdated: boolean) {
    super(VersionEvent.type)
  }
}
