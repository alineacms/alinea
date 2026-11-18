# Vendored packages

## `alinea-graft-0.1.0.tgz`

`@alinea/graft` is not published yet, so alinea depends on a packed build:
`"@alinea/graft": "file:vendor/alinea-graft-0.1.0.tgz"`. It is a dev
dependency, as alinea's build bundles it.

Built from graft at commit `7de650f707c9c1f732ce4bff34215416b497e644` (`main`), from a clean
`git archive` of that commit.

graft's `rado` peer range, `>=1.3.0-preview.11 <2`, holds alinea's
`1.3.0-preview.11`, so both use one copy and one `Database` type.

To refresh it:

Build from a commit rather than graft's working tree, which may hold
uncommitted work:

```sh
rm -rf /tmp/graft-main && mkdir -p /tmp/graft-main /tmp/graft-pack
git -C ../graft archive main | tar -x -C /tmp/graft-main
ln -s "$(cd ../graft && pwd)/node_modules" /tmp/graft-main/node_modules
(cd /tmp/graft-main && ./node_modules/.bin/tsc -p tsconfig.build.json \
  && bun pack/Imports.ts \
  && npm pack --ignore-scripts --pack-destination /tmp/graft-pack)
cp /tmp/graft-pack/alinea-graft-0.1.0.tgz vendor/
bun install --force
```

Then update the commit above with `git -C ../graft rev-parse main`. If the
version changes, rename the tarball and the dependency with it.
