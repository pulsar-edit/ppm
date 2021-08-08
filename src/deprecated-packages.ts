import semver from "semver"
let deprecatedPackages: DeprecatedPackages | undefined

type DeprecatedPackage = {
  version?: string
  hasDeprecations?: boolean
  latestHasDeprecations?: boolean
  message?: string
  hasAlternative?: boolean
  alternative?: string
}

type DeprecatedPackages = Record<string, DeprecatedPackage>

export function isDeprecatedPackage(name: string, version: string) {
  if (deprecatedPackages === undefined) {
    deprecatedPackages = require("../deprecated-packages") as DeprecatedPackages
  }
  if (!(name in deprecatedPackages)) {
    return false
  }

  const deprecatedVersionRange = deprecatedPackages[name].version
  if (!deprecatedVersionRange) {
    return true
  }

  return (
    semver.valid(version) &&
    semver.validRange(deprecatedVersionRange) &&
    semver.satisfies(version, deprecatedVersionRange)
  )
}
