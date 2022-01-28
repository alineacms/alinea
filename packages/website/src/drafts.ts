import {schema} from '.alinea'
import {FirestoreDrafts} from '@alinea/server/drafts/FirestoreDrafts'
import dotenv from 'dotenv'
import {cert, initializeApp} from 'firebase-admin/app'
import {getFirestore} from 'firebase-admin/firestore'

dotenv.config({path: '../../.env'})

initializeApp({
  credential: cert(JSON.parse(process.env.FIRESTORE_SERVICE_ACCOUNT!))
})
export const drafts = new FirestoreDrafts({
  schema,
  collection: getFirestore().collection('Draft')
})
