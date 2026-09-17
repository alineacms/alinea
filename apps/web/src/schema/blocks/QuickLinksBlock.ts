import {Config, Field} from 'alinea'

export const QuickLinksBlock = Config.type('Quick links', {
  fields: {
    items: Field.list('Items', {
      schema: {
        Item: Config.type('Item', {
          fields: {
            icon: Field.select('Icon', {
              width: 0.25,
              options: {
                IcBaselineCloudQueue: 'IcBaselineCloudQueue',
                IcBaselineDashboardCustomize: 'IcBaselineDashboardCustomize',
                IcBaselineWorkspaces: 'IcBaselineWorkspaces',
                IcRoundFastForward: 'IcRoundFastForward',
                IcRoundInsertDriveFile: 'IcRoundInsertDriveFile',
                IcRoundPublish: 'IcRoundPublish',
                MdiSourceBranch: 'MdiSourceBranch',
                MdiLanguageTypescript: 'MdiLanguageTypescript',
                PhGlobe: 'PhGlobe',
                ProiconsOpenSource: 'ProiconsOpenSource',
                RiFlashlightFill: 'RiFlashlightFill'
              }
            }),
            link: Field.link('Link', {
              fields: {
                label: Field.text('Label')
              }
            })
          }
        })
      }
    })
  }
})
