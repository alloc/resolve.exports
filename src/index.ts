type ExportMapping = null | string | PackageExports | readonly ExportMapping[]

export type PackageExports = {
  [key: string]: ExportMapping
}

export type PackageJson = {
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

const pathMatchersCache = new WeakMap<PackageExports, PathMatcher[]>()

export const resolveExports: ResolveExports = (
  pkg,
  entry,
  options = {},
  inlineConditions
) => {
  const { assertMatch } = options
  if (entry !== '.' && !entry.startsWith('./')) {
    return missingEntry(pkg, entry, assertMatch)
  }

  let { exports } = pkg
  if (!exports || typeof exports !== 'object' || isArray(exports)) {
    exports = { '.': exports || null }
  }

  const conditions = expandSet(
    new Set(options.conditions),
    inlineConditions,
    options.isProduction ? 'production' : 'development',
    options.isRequire ? 'require' : ['import', 'module'],
    'default'
  )

  const keys = Object.keys(exports)
  if (keys[0][0] !== '.') {
    return (
      (entry === '.' &&
        resolveMapping(pkg, entry, exports, conditions, assertMatch)) ||
      missingEntry(pkg, entry, assertMatch)
    )
  }

  const matchers = pathMatchersCache.get(exports) || []
  pathMatchersCache.set(exports, matchers)

  let globResolved: string[] | undefined

  for (let i = 0; i < keys.length; i++) {
    const [matcher, mapping] = (matchers[i] ||= parsePathPattern(
      pkg,
      keys[i],
      exports
    ))

    const match = entry.match(matcher)
    if (match) {
      const isExactMatch = match.length === 1
      const resolved = resolveMapping(
        pkg,
        entry,
        mapping,
        conditions,
        assertMatch && isExactMatch
      )

      if (resolved === null) {
        return missingEntry(pkg, entry, assertMatch)
      }

      // An exact match always ends the matcher loop.
      if (isExactMatch) {
        return resolved
      }

      if (resolved.length === 0) {
        // The glob was matched but conditions did not match.
        // Keep looking.
        continue
      }

      // In the case of glob patterns, the last match wins and so we
      // shouldn't return yet.
      globResolved = resolved.map((path) => {
        let slotIndex = 1
        return path.replace(trailingSlashRE, '/*').replace(wildTokenRE, () => {
          return match[Math.min(match.length - 1, slotIndex++)]
        })
      })
    }
  }

  if (globResolved) {
    return globResolved
  }

  return missingEntry(pkg, entry, assertMatch)
}

const isArray = Array.isArray as (value: unknown) => value is readonly unknown[]

function resolveMapping(
  pkg: PackageJson,
  entry: string,
  mapping: ExportMapping,
  conditions: Set<string>,
  assertMatch?: boolean
): string[] | null {
  if (mapping === null) {
    return null
  }
  if (typeof mapping === 'string') {
    return [mapping]
  }
  if (isArray(mapping)) {
    return resolveArray(pkg, entry, mapping, conditions, assertMatch)
  }
  return resolveConditions(pkg, entry, mapping, conditions, assertMatch)
}

function resolveArray(
  pkg: PackageJson,
  entry: string,
  mapping: readonly ExportMapping[],
  conditions: Set<string>,
  assertMatch?: boolean
): string[] | null {
  const resolved: string[] = []
  for (const m of mapping) {
    const mapped = resolveMapping(pkg, entry, m, conditions)
    if (mapped === null) {
      return null
    }
    resolved.push(...mapped)
  }
  if (resolved.length === 0) {
    return missingEntry(pkg, entry, assertMatch)
  }
  return resolved
}

function resolveConditions(
  pkg: PackageJson,
  entry: string,
  exports: PackageExports,
  conditions: Set<string>,
  assertMatch?: boolean
): string[] | null {
  for (const condition in exports) {
    if (conditions.has(condition)) {
      const resolved = resolveMapping(
        pkg,
        entry,
        exports[condition],
        conditions
      )
      if (resolved === null) {
        return null
      }
      if (resolved.length > 0) {
        return resolved
      }
    } else if (condition[0] === '.') {
      throw new Error(
        `Invalid condition "${condition}" in "${pkg.name}" package`
      )
    }
  }
  if (assertMatch)
    throw new Error(
      `No known conditions for "${entry}" entry in "${pkg.name}" package`
    )
  return []
}

const wildTokenRE = /\*/g
const trailingSlashRE = /\/$/
const escapedTokenRE = /[|\\{}()[\]^$+?.]/g

type PathMatcher = [RegExp, ExportMapping]

function parsePathPattern(
  pkg: PackageJson,
  pattern: string,
  exports: PackageExports
): PathMatcher {
  if (pattern[0] !== '.')
    throw new Error(
      `Invalid path pattern "${pattern}" in "${pkg.name}" package`
    )

  const escapedPattern = pattern
    .replace(trailingSlashRE, '/*')
    .replace(escapedTokenRE, '\\$&')
    .replace(wildTokenRE, '(.*?)')

  return [new RegExp(`^${escapedPattern}$`), exports[pattern]]
}

function missingEntry(
  pkg: PackageJson,
  entry: string,
  assertMatch?: boolean
): string[] {
  if (assertMatch) {
    throw new Error(`Missing "${entry}" export in "${pkg.name}" package`)
  }
  return []
}

function expandSet<T>(set: Set<T>, ...conditions: (T | T[] | undefined)[]) {
  conditions.flat().forEach((arg: any) => arg && set.add(arg))
  return set
}
