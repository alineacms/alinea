import {Config, Field} from 'alinea'
import {IcRoundViewModule} from '@/layout/icons/IcRoundViewModule'

export const FeaturesBlock = Config.type('Features', {
  icon: IcRoundViewModule,
  fields: {
    items: Field.list('Items', {
      schema: {
        FeatureItem: Config.type('Item', {
          fields: {
            icon: Field.select('Icon', {
              width: 0.25,
              options: {
                IcBaselineDashboardCustomize: 'IcBaselineDashboardCustomize',
                IcRoundFastForward: 'IcRoundFastForward',
                MdiSourceBranch: 'MdiSourceBranch',
                MdiLanguageTypescript: 'MdiLanguageTypescript',
                ProiconsOpenSource: 'ProiconsOpenSource',
                RiFlashlightFill: 'RiFlashlightFill'
              }
            }),
            title: Field.text('Title', {
              width: 0.75
            }),
            description: Field.richText('Description')
          }
        })
      }
    })
  }
})
