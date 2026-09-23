import {Config, Field} from 'alinea'

/** Icons that editors can pick, keys match exports of `@/icons` */
export const iconOptions = {
  StrokeAccessibility: 'Accessibility',
  StrokeShieldCheck: 'Shield',
  StrokeCode: 'Code',
  StrokeGlobe: 'Globe',
  StrokeLink: 'Link',
  StrokeHook: 'Hook',
  StrokeGitBranch: 'Git branch',
  StrokeSearch: 'Search',
  StrokeCloud: 'Cloud',
  StrokeSparkle: 'Sparkle',
  StrokeHeart: 'Heart',
  StrokeCheck: 'Check',
  StrokeHistory: 'History',
  StrokeUsers: 'Users',
  StrokeLock: 'Lock',
  StrokeFile: 'File',
  StrokeMail: 'Mail'
}

export type IconName = keyof typeof iconOptions

/** Optional id so the section can be linked to, eg. `/#features` */
export function anchorField() {
  return Field.text('Anchor', {
    help: 'Optional id to link to this section, eg. "features" for /#features'
  })
}

/** A link with a label, like the homepage hero buttons */
export function labeledLink(label: string, width?: number) {
  return Field.link(label, {
    width,
    fields: {
      label: Field.text('Label')
    }
  })
}

/** A list of short lines rendered with a check mark */
export function checksField(label = 'Checks') {
  return Field.list(label, {
    schema: {
      Item: Config.type('Item', {
        fields: {
          text: Field.text('Text')
        }
      })
    }
  })
}
