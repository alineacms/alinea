import {Config} from 'alinea'

/** Roles of the demo team, next to the built-in admin role */
export const demoRoles = {
  editor: Config.role('Editor', {
    description: 'Creates, edits and publishes content',
    permissions(policy) {
      policy.set({allow: {all: true}, deny: {manageMembers: true}})
    }
  }),
  translator: Config.role('Translator', {
    description: 'Translates content into Dutch and French',
    permissions(policy) {
      policy.set(
        {allow: {read: true, explore: true}},
        {locale: 'nl', allow: {create: true, update: true, publish: true}},
        {locale: 'fr', allow: {create: true, update: true, publish: true}}
      )
    }
  }),
  viewer: Config.role('Viewer', {
    description: 'Can browse content but not change it',
    permissions(policy) {
      policy.set({allow: {read: true, explore: true}})
    }
  })
}
