# Vendored packages

## `alinea-graft-0.1.0.tgz`

`@alinea/graft` is not published yet, so alinea depends on a packed build:
`"@alinea/graft": "file:vendor/alinea-graft-0.1.0.tgz"`. It is a dev
dependency, as alinea's build bundles it.

Built from graft at commit `221d61e2382d80e2e565f6cb6bf7d4bfb86a16a9`.

graft's `rado` peer range, `>=1.3.0-preview.11 <2`, holds alinea's
`1.3.0-preview.11`, so both use one copy and one `Database` type.

To refresh it:

```sh
cd ../graft
bun run build
npm pack --ignore-scripts --pack-destination /tmp/graft-pack
cd ../alinea
cp /tmp/graft-pack/alinea-graft-0.1.0.tgz vendor/
bun install --force
```

Then update the commit above with `git -C ../graft rev-parse HEAD`. If the
version changes, rename the tarball and the dependency with it.
