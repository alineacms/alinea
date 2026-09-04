const generatedEnvironmentVariables = [
  'ALINEA_ADMIN_PATH',
  'ALINEA_GENERATED_RELEASE',
  'ALINEA_GENERATED_CONFIG',
  'ALINEA_RELEASE_URL',
  'ALINEA_CONFIG_URL'
] as const

export interface GeneratedEnvironment {
  adminPath: string
  releaseId: string
  configId: string
  releaseUrl: string
  configUrl: string
}

export function generatedEnvironment(
  environment: Record<string, string | undefined> = process.env
): GeneratedEnvironment {
  const missing = generatedEnvironmentVariables.filter(
    name => !environment[name]
  )
  if (missing.length > 0) {
    throw new Error(
      [
        `Alinea's generated runtime environment is missing: ${missing.join(', ')}.`,
        'Wrap your Next.js configuration with withAlinea from "alinea/next", then rebuild the application.',
        'Example: export default withAlinea(nextConfig)'
      ].join(' ')
    )
  }
  return {
    adminPath: environment.ALINEA_ADMIN_PATH!,
    releaseId: environment.ALINEA_GENERATED_RELEASE!,
    configId: environment.ALINEA_GENERATED_CONFIG!,
    releaseUrl: environment.ALINEA_RELEASE_URL!,
    configUrl: environment.ALINEA_CONFIG_URL!
  }
}
