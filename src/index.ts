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
    entry: string | string[],
    options?: ResolveExports.Options,
    inlineConditions?: string[],
    allowedConditions?: string[]
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

const pathMatchersCache = new WeakMap<PackageExports, RegExp[]>()

export const resolveExports: ResolveExports = (
  pkg,
  entry,
  options = {},
  inlineConditions,
  allowedConditions
) => {
  if (Array.isArray(entry)) {
    const resolved = entry.map((e) =>
      resolveExports(pkg, e, options, inlineConditions, allowedConditions)
    )
    return resolved.flat()
  }
  if (entry !== '.' && !entry.startsWith('./')) {
    return []
  }

  let { exports } = pkg
  if (!exports || typeof exports !== 'object' || isArray(exports)) {
    exports = { '.': exports || null }
  }

  const conditions = expandSet(
    new Set(inlineConditions),
    options.conditions,
    options.isProduction ? 'production' : 'development'
  )
  // An explicit "import" condition prevents "require" from being used.
  if (!conditions.has('import')) {
    expandSet(conditions, options.isRequire ? 'require' : 'import')
  }
  if (allowedConditions) {
    for (const condition of conditions) {
      if (!allowedConditions.includes(condition)) {
        conditions.delete(condition)
      }
    }
  }
  // The "default" condition is always allowed.
  conditions.add('default')

  const keys = Object.keys(exports)
  if (keys[0][0] !== '.') {
    return (
      (entry === '.' && resolveMapping(pkg, entry, exports, conditions)) || []
    )
  }

  const matchers = pathMatchersCache.get(exports) || []
  pathMatchersCache.set(exports, matchers)

  let globPattern: string | undefined
  let globResolved: string[] | undefined

  for (let i = 0; i < keys.length; i++) {
    const pattern = keys[i].replace(trailingSlashRE, '/*')
    const matcher = (matchers[i] ||= parsePathPattern(pkg, pattern))

    const match = entry.match(matcher)
    if (match) {
      const isExactMatch = match.length === 1
      const resolved = resolveMapping(pkg, entry, exports[keys[i]], conditions)

      if (resolved === null) {
        return []
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

      if (globPattern && patternKeyCompare(globPattern, pattern) <= 0) {
        // The glob was matched and conditions matched, but a better
        // match was already found. Keep looking.
        continue
      }

      // In the case of glob patterns, the most specific pattern wins
      // and so we shouldn't return yet.
      globPattern = pattern
      globResolved = resolved.map((path) => {
        let slotIndex = 1
        return path.replace(trailingSlashRE, '/*').replace(wildTokenRE, () => {
          return match[Math.min(match.length - 1, slotIndex++)]
        })
      })
    }
  }

  return globResolved || []
}

const isArray = Array.isArray as (value: unknown) => value is readonly unknown[]

function resolveMapping(
  pkg: PackageJson,
  entry: string,
  mapping: ExportMapping,
  conditions: Set<string>
): string[] | null {
  if (mapping === null) {
    return null
  }
  if (typeof mapping === 'string') {
    return [mapping]
  }
  if (isArray(mapping)) {
    return resolveArray(pkg, entry, mapping, conditions)
  }
  return resolveConditions(pkg, entry, mapping, conditions)
}

function resolveArray(
  pkg: PackageJson,
  entry: string,
  mapping: readonly ExportMapping[],
  conditions: Set<string>
): string[] | null {
  const resolved: string[] = []
  for (const m of mapping) {
    const mapped = resolveMapping(pkg, entry, m, conditions)
    if (mapped === null) {
      return null
    }
    resolved.push(...mapped)
  }
  return resolved
}

function resolveConditions(
  pkg: PackageJson,
  entry: string,
  exports: PackageExports,
  conditions: Set<string>
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
  return []
}

const wildTokenRE = /\*/g
const trailingSlashRE = /\/$/
const escapedTokenRE = /[|\\{}()[\]^$+?.]/g

function parsePathPattern(pkg: PackageJson, pattern: string): RegExp {
  if (pattern[0] !== '.')
    throw new Error(
      `Invalid path pattern "${pattern}" in "${pkg.name}" package`
    )

  const escapedPattern = pattern
    .replace(escapedTokenRE, '\\$&')
    .replace(wildTokenRE, '(.*?)')

  return new RegExp(`^${escapedPattern}$`)
}

/**
 * Adapted from…
 *   https://github.com/nodejs/node/blob/3c423a2030d35faace4aa85a7a05ed816a32f8d1/lib/internal/modules/esm/resolve.js#L605
 * …except we only call it when both `a` and `b` are globs.
 */
function patternKeyCompare(a: string, b: string) {
  const aPatternIndex = a.indexOf('*')
  const bPatternIndex = b.indexOf('*')
  if (aPatternIndex > bPatternIndex) return -1
  if (bPatternIndex > aPatternIndex) return 1
  /* c8 ignore start */
  if (a.length > b.length) return -1
  if (b.length > a.length) return 1
  return 0
  /* c8 ignore end */
}

function expandSet<T>(
  set: Set<T>,
  ...conditions: (T | readonly T[] | undefined)[]
): Set<T> {
  conditions.flat().forEach((arg: any) => arg && set.add(arg))
  return set
}
