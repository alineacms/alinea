import {defineNuxtPlugin, refreshNuxtData} from '#imports'

// Live previews refresh the data of the page instead of reloading it
export default defineNuxtPlugin(() => {
  addEventListener('alinea:refresh', event => {
    event.preventDefault()
    refreshNuxtData().finally(event.detail.done)
  })
})
