// @ts-ignore
import {release} from '@alinea/generated/store.js'

// Excluding this from edge routes in Next.js currently does not work,
// even if specified in serverComponentsExternalPackages, you will have
// to specify an api key to get authorized
export const generatedRelease: string = release
