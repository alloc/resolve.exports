# @alloc/resolve.exports

An improved version of the acclaimed [`resolve.exports`](https://github.com/lukeed/resolve.exports) package.

- written in TypeScript
- prefer readability over code golfing
- only 19% larger than the original package (+146 bytes)
- tests use [Vitest](https://github.com/vitest-dev/vitest) (100% test coverage)
- code formatted with Prettier

&nbsp;

### API differences

This package exports a `resolveExports` function, whose type signature is incompatible with the original `resolve.exports` package. A few options have been removed or renamed to better fit the needs of [Vite](https://github.com/vitejs/vite). This package has no [`legacy`](https://github.com/lukeed/resolve.exports/#legacypkg-options) function export.

#### Fallback arrays

To support the "fallback array" feature (useful for glob patterns), the `resolveExports` function will always return an array of paths. If no matches are found, the array will be empty, unless the `assertMatch` option is true (in which case, an error will be thrown).

#### Renamed options

The [`require`](https://github.com/lukeed/resolve.exports/#optionsrequire) was renamed to `isRequire` to match the resolve options used by Vite internals. This allows Vite to avoid creating a new object for every call to `resolveExports`.

#### Removed options

The [`unsafe`](https://github.com/lukeed/resolve.exports/#optionsunsafe) and `browser` options have been removed. There is no way to replicate the behavior of `unsafe` in this package. The [`browser`](https://github.com/lukeed/resolve.exports/#optionsbrowser) option was removed because I want to leave room for future platform conditions (beyond just `browser` and `node`).

&nbsp;

### Type definitions

```ts
export declare type PackageJson = {
  name?: string
  exports?: ExportMapping | PackageExports
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
     * Throw an error if no matching entry is found.
     */
    assertMatch?: boolean
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
