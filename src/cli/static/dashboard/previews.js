import {mountPreviews} from 'alinea/preview/client'

// A classic script, so it can read its options from its own tag
const {dataset} = document.currentScript

mountPreviews({
  dashboardUrl: dataset.dashboardUrl,
  widget: 'widget' in dataset,
  stats: dataset.stats ? JSON.parse(dataset.stats) : undefined,
  workspace: dataset.workspace,
  root: dataset.root
})
