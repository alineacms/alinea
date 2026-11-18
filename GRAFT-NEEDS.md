# What alinea needs from graft

Against the vendored graft `31d51ac` (`main`). The earlier needs are all in
graft now; what is left follows them.

## Landed in `31d51ac`, and what alinea did with them

| Need | In graft | In alinea |
| --- | --- | --- |
| Deltas against the receiver's version only | `packSince(store, have, head, {window: 0})` | `GET ?action=sync&have=` (graft backend and `alinea dev`) writes with `window: 0`; a full pack uses the default window |
| A full pack with deltas fast enough for a build | about 2 s at 20,000 files | not used yet: the first dashboard sync stays on Tree and Blob, see `BENCHMARKS.md` |
| `diffTrees` with moves, a pack since a tree | `compareTrees`, `packSince` | `src/core/source/CompareTrees.ts` and `src/backend/api/ContentPack.ts` removed |
| Reading git's index | `GitRepository.index()` | a cold `alinea dev` takes staged shas (`src/cli/generate/StagedFiles.ts`) |
| Renames where one side left the record alone | `merge` renames all three values first | `src/core/graft/Rename.ts` removed |
| An edit under an old name next to the new one | the old name counts as that side's edit | as above |
| `ShapeMismatchError` and `fingerprint` at the root | exported | `LiveSession` imports `ShapeMismatchError` from the root |

`TreeMergeOptions.baseOf` became `basesOf`: alinea had no call site.

## 1. Whether a checkout writes the bytes git stages

`GitRepository.index()` gives the sha git staged, which is the sha of the
file after its clean conversion. A file checked out with CRLF line endings
(`core.autocrlf=true`, `eol=crlf`, `text` on Windows), through a filter or
with `ident` holds other bytes than that blob, even with a matching stat:

```sh
git init -q repo && cd repo
git config core.autocrlf true
printf '{"title":"A"}\n' > a.json && git add a.json
git ls-files -s a.json                 # the sha of the LF file
rm a.json && git checkout a.json       # written back with CRLF
git hash-object --no-filters a.json    # another sha, same stat as staged
```

So alinea guesses from the repository's config, the user's global config
and `.gitattributes` files from the content directory up whether a checkout
converts, and then hashes every file (`converts` in
`src/cli/generate/StagedFiles.ts`). The guess reads no system config, no
`include`/`includeIf`, and no `.gitattributes` below the content directory.
What would make it exact: per index entry, whether the checkout of the path
converts it (git's `convert_to_working_tree` decision from config and
attributes), or a function answering that for a path.

## 2. Observations that are not needs (yet)

- `readPack` inflates in JavaScript (the pack format needs to know where
  each zlib stream ends): 1.8 s for 13 MB with 20,000 objects in Bun. alinea
  keeps the first dashboard load on Tree and Blob partly for this reason.
  graft's new streaming `unpack` is not used by alinea yet.
- `sqlRepository` stores objects uncompressed, so the server's database
  holds the content once more beside alinea's index. `BucketStore` and
  `LazyStore`'s cache could keep blobs in R2 or S3 instead; not adopted.
- Not adopted either, possibly useful later: `packStream` and
  `Remote.fetch({store})` for the first load, `gitServer`'s `stage`, the
  Durable Object store (`@alinea/graft/durable`), `gitRemote({paths})`, and
  lenses with separate `create` and `remove` rights for reading rights.
