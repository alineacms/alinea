// Excluding this from edge routes in Next.js currently does not work,
// even if specified in serverComponentsExternalPackages, you will have
// to specify an api key to get authorized.
// We import dynamically because the alinea source could be compiled to CJS
// while the generated code is ESM.
export const generatedRelease: Promise<string> =
  // @ts-ignore
  import('@alinea/generated/release.js').then(module => module.release)
