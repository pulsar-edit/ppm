
const semver = require('semver');
let deprecatedPackages = null;

exports.isDeprecatedPackage = function(name, version) {
  deprecatedPackages ??= require("../deprecated-packages") ?? {};
  if (!deprecatedPackages.hasOwnProperty(name)) { return false; }

  const deprecatedVersionRange = deprecatedPackages[name].version;
  if (!deprecatedVersionRange) { return true; }

  return semver.valid(version) && semver.validRange(deprecatedVersionRange) && semver.satisfies(version, deprecatedVersionRange);
};
