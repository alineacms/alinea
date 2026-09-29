// Excluding this from edge routes in Next.js currently does not work,
// even if specified in serverComponentsExternalPackages, you will have
// to specify an api key to get authorized.
// We import dynamically because the alinea source could be compiled to CJS
// while the generated code is ESM. Only on request, so importing alinea
// without a generated package (eg. in scripts) does not fail.
export function generatedRelease(): Promise<string> {
  // @ts-ignore
  return import('@alinea/generated/release.js').then(module => module.release)
}
