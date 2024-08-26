import {decode} from 'buffer-to-base64'
import PLazy from 'p-lazy'
import {Store} from '../Store.js'
import {createStore} from './CreateStore.js'

export const generatedStore: Promise<Store> = PLazy.from(async () => {
  // @ts-ignore
  const {storeData} = await import('@alinea/generated/store.js').catch(() => {
    return {storeData: ''}
  })
  return createStore(new Uint8Array(await decode(storeData)))
})
