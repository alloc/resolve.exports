import { test, describe, expect } from 'vitest'
import { PackageJson, ResolveExports, resolveExports } from '.'

const isRequire = { isRequire: true }
const isProduction = { isProduction: true }
const opts = (...args: ResolveExports.Options[]) => Object.assign({}, ...args)

describe('resolveExports', () => {
  test('exports = string', () => {
    const pkg: PackageJson = { exports: './foo.js' }

    expect(resolveExports(pkg, '.')).toEqual(['./foo.js'])

    // Invalid entry
    expect(resolveExports(pkg, './bar')).toEqual([])
  })

  test('exports = conditions object', () => {
    const pkg: PackageJson = {
      name: 'foo',
      exports: {
        import: './foo.js'
      }
    }

    expect(resolveExports(pkg, '.')).toEqual(['./foo.js'])

    // Invalid entry
    expect(resolveExports(pkg, './bar')).toEqual([])
  })

  describe('exports = paths object', () => {
    test('exact subpath match', () => {
      const pkg: PackageJson = {
        exports: {
          './foo': './foo.js'
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./foo.js'])
      // Ends with trailing slash.
      expect(resolveExports(pkg, './foo/')).toEqual([])
      // Starts with pattern but is not exact match.
      expect(resolveExports(pkg, './fook')).toEqual([])
      expect(resolveExports(pkg, './foo/bar')).toEqual([])

      // Include a conditions object.
      pkg.exports = {
        './foo': {
          import: {
            development: './foo.js'
          }
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./foo.js'])
      expect(resolveExports(pkg, './foo', isRequire)).toEqual([])
      expect(resolveExports(pkg, './foo', isProduction)).toEqual([])
    })

    test('wildcard token', () => {
      const pkg: PackageJson = {
        exports: {
          // Simple trailing glob
          './*': './*.js',
          // Map two globs to two slots
          './*.*': './*/index.*',
          // Map one glob to two slots
          './*.css': './*/*.css',
          // Map one glob to one slot
          './*.ts': './*/index.ts'
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./foo.js'])
      expect(resolveExports(pkg, './bar')).toEqual(['./bar.js'])
      // The "./*" pattern does not match "."
      expect(resolveExports(pkg, '.')).toEqual([])
      // Include a path separator
      expect(resolveExports(pkg, './foo/bar')).toEqual(['./foo/bar.js'])
      // Match the "./*.ts" pattern
      expect(resolveExports(pkg, './foo.ts')).toEqual(['./foo/index.ts'])
      // Match the "./*.css" pattern
      expect(resolveExports(pkg, './foo.css')).toEqual(['./foo/foo.css'])
      // Match the "./*.*" pattern
      expect(resolveExports(pkg, './foo.coffee')).toEqual([
        './foo/index.coffee'
      ])
    })

    test('string mapping', () => {
      const pkg: PackageJson = {
        exports: {
          '.': './foo.js'
        }
      }

      expect(resolveExports(pkg, '.')).toEqual(['./foo.js'])

      // Invalid entry
      expect(resolveExports(pkg, './bar')).toEqual([])
    })

    test('string mapping with nested conditions', () => {
      const pkg: PackageJson = {
        name: 'foo',
        exports: {
          '.': {
            import: {
              development: './foo.js'
            }
          }
        }
      }

      expect(resolveExports(pkg, '.')).toEqual(['./foo.js'])

      // Does not match "import" condition
      expect(resolveExports(pkg, '.', isRequire)).toEqual([])

      // Matches "import" condition but not "development"
      expect(resolveExports(pkg, '.', opts(isProduction))).toEqual([])
    })

    test('string mapping with default condition', () => {
      const pkg: PackageJson = {
        name: 'foo',
        exports: {
          '.': {
            import: './foo.js',
            default: './foo.cjs'
          }
        }
      }

      expect(resolveExports(pkg, '.')).toEqual(['./foo.js'])
      expect(resolveExports(pkg, '.', isRequire)).toEqual(['./foo.cjs'])

      // First matching condition takes precedence.
      // In this case, the "default" condition is always used.
      pkg.exports = {
        '.': {
          default: './foo.cjs',
          import: './foo.js'
        }
      }

      expect(resolveExports(pkg, '.')).toEqual(['./foo.cjs'])
    })

    test('array mapping', () => {
      const pkg: PackageJson = {
        exports: {
          './*': ['./*.js', './*.cjs']
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./foo.js', './foo.cjs'])
      expect(resolveExports(pkg, './bar')).toEqual(['./bar.js', './bar.cjs'])

      // Note: File extensions are preserved.
      // TODO: Should they be replaced instead?
      expect(resolveExports(pkg, './foo.js')).toEqual([
        './foo.js.js',
        './foo.js.cjs'
      ])
    })

    test('array mapping with nested conditions', () => {
      const pkg: PackageJson = {
        exports: {
          './*': [
            { import: { development: './*.js' } },
            { require: ['./*.cjs'] }
          ],
          './bar': [{ import: null }, './bar.cjs']
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./foo.js'])
      expect(resolveExports(pkg, './foo', isRequire)).toEqual(['./foo.cjs'])
      expect(resolveExports(pkg, './foo', isProduction)).toEqual([])
      expect(resolveExports(pkg, './bar')).toEqual([])
      expect(resolveExports(pkg, './bar', isRequire)).toEqual(['./bar.cjs'])
    })

    test('null mapping', () => {
      const pkg: PackageJson = {
        exports: {
          './*': './*.js',
          './bar': { import: null, default: './bar.cjs' },
          './internal/*': null
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./foo.js'])
      expect(resolveExports(pkg, './bar', isRequire)).toEqual(['./bar.cjs'])
      expect(resolveExports(pkg, './bar')).toEqual([])
      expect(resolveExports(pkg, './internal/foo')).toEqual([])
    })

    // Webpack-defined syntax:
    //   https://webpack.js.org/guides/package-exports/#general-syntax
    test('trailing slash', () => {
      const pkg: PackageJson = {
        exports: {
          './foo/': './1/',
          './foo/bar/': './2/',
          './': './3/'
        }
      }

      expect(resolveExports(pkg, './foo')).toEqual(['./3/foo'])
      expect(resolveExports(pkg, './foo/')).toEqual(['./1/'])
      expect(resolveExports(pkg, './foo/main.js')).toEqual(['./1/main.js'])
      expect(resolveExports(pkg, './foo/bar/main.js')).toEqual(['./2/main.js'])
    })
  })

  // https://github.com/lukeed/resolve.exports/issues/19
  test('path pattern with leading dot', () => {
    const pkg: PackageJson = {
      exports: { './.warnings.jsii.js': './.warnings.jsii.js' }
    }

    expect(resolveExports(pkg, './.warnings.jsii.js')).toEqual([
      './.warnings.jsii.js'
    ])
  })

  test('nested condition mismatch', () => {
    const pkg: PackageJson = {
      exports: {
        '.': {
          import: {
            production: './foo.js'
          },
          default: './foo.cjs'
        }
      }
    }

    // Although the "import" condition is matched, the "production"
    // condition is not, and so the "default" condition is used.
    expect(resolveExports(pkg, '.')).toEqual(['./foo.cjs'])
  })

  test('invalid entry argument', () => {
    const pkg: PackageJson = {
      exports: { './foo': './foo.js' }
    }

    expect(resolveExports(pkg, '')).toEqual([])
    expect(resolveExports(pkg, 'foo')).toEqual([])
    expect(resolveExports(pkg, '../foo')).toEqual([])
  })

  test('invalid path pattern', () => {
    const pkg: PackageJson = {
      name: 'foo',
      exports: {
        '.': './index.js',
        // Conditions cannot be mixed with path patterns.
        import: './foo.js'
      }
    }

    expect(() =>
      resolveExports(pkg, './foo')
    ).toThrowErrorMatchingInlineSnapshot(
      '"Invalid path pattern \\"import\\" in \\"foo\\" package"'
    )
  })

  test('invalid condition', () => {
    const pkg: PackageJson = {
      name: 'foo',
      exports: {
        './foo': {
          // Path patterns cannot be nested.
          './bar': './bar.cjs'
        }
      }
    }

    expect(() =>
      resolveExports(pkg, './foo')
    ).toThrowErrorMatchingInlineSnapshot(
      '"Invalid condition \\"./bar\\" in \\"foo\\" package"'
    )
  })

  test('undefined pkg.exports', () => {
    const pkg: PackageJson = {}

    expect(resolveExports(pkg, './foo')).toEqual([])
  })
})
