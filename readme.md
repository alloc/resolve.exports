# @alloc/resolve.exports

An improved version of the acclaimed [`resolve.exports`](https://github.com/lukeed/resolve.exports) package.

- written in TypeScript
- prefer readability over code golfing
- only 50% larger than the original package (+1.5kB, unminified)
- tests use [Vitest](https://github.com/vitest-dev/vitest) (100% test coverage)
- code formatted with Prettier

&nbsp;

### API differences

This package exports a `resolveExports` function, whose type signature is incompatible with the original `resolve.exports` package. A few options have been removed or renamed to better fit the needs of [Vite](https://github.com/vitejs/vite).

This package has no [`legacy`](https://github.com/lukeed/resolve.exports/#legacypkg-options) function export.

This package only throws errors for invalid `exports` syntax. It returns an empty array if no modules are matched.

#### Fallback arrays

To support the "fallback array" feature (useful for glob patterns), the `resolveExports` function will always return an array of paths. If no matches are found, the array will be empty.

#### Renamed options

The [`require`](https://github.com/lukeed/resolve.exports/#optionsrequire) was renamed to `isRequire` to match the resolve options used by Vite internals. This allows Vite to avoid creating a new object for every call to `resolveExports`.

#### Removed options

The [`unsafe`](https://github.com/lukeed/resolve.exports/#optionsunsafe) and `browser` options have been removed. There is no way to replicate the behavior of `unsafe` in this package. The [`browser`](https://github.com/lukeed/resolve.exports/#optionsbrowser) option was removed because I want to leave room for future platform conditions (beyond just `browser` and `node`).

#### Bug fixes

The following issues from `resolve.exports` are fixed by this package:

- https://github.com/lukeed/resolve.exports/issues/7
- https://github.com/lukeed/resolve.exports/issues/9
- https://github.com/lukeed/resolve.exports/issues/16
- https://github.com/lukeed/resolve.exports/issues/17
- https://github.com/lukeed/resolve.exports/issues/19

&nbsp;

### Type definitions

```ts
type ExportMapping = null | string | PackageExports | readonly ExportMapping[]
export type PackageExports = {
  [key: string]: ExportMapping
}
export type PackageJson = {
  name?: string
  exports?: ExportMapping
}
export interface ResolveExports {
  (
    pkg: PackageJson,
    entry: string,
    options?: ResolveExports.Options,
    inlineConditions?: string[]
  ): string[]
}
export namespace ResolveExports {
  export type Options = {
    /**
     * Custom conditions to match with.
     *
     * @example ['node']
     */
    conditions?: readonly string[]
    /**
     * When true, the `production` condition is used. Otherwise, the
     * `development` condition is used.
     */
    isProduction?: boolean
    /**
     * When true, the `require` condition is used. Otherwise, the
     * `import` condition is used.
     */
    isRequire?: boolean
  }
}
```
