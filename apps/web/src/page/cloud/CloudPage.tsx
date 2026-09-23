import type {Metadata} from 'next'
import {getMetadata, type MetadataProps} from '@/utils/metadata'
import {CloudBeta} from './CloudBeta'
import {CloudFaq} from './CloudFaq'
import {CloudFeatures} from './CloudFeatures'
import {CloudFlow} from './CloudFlow'
import {CloudHero} from './CloudHero'
import {CloudScope} from './CloudScope'
import {CloudSteps} from './CloudSteps'

const description =
  'Alinea Cloud is the hosted backend for Alinea: sign-in for your editors, drafts kept out of your repository, and publishing straight to your GitHub repo. Free while in beta.'

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata({
    url: '/cloud',
    title: 'Alinea Cloud',
    metadata: {title: 'Alinea Cloud', description}
  } as MetadataProps)
}

export const dynamic = 'force-static'

export default function CloudPage() {
  return (
    <>
      <CloudHero />
      <CloudFlow />
      <CloudScope />
      <CloudFeatures />
      <CloudSteps />
      <CloudBeta />
      <CloudFaq />
    </>
  )
}
