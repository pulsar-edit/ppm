/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require('underscore-plus')
const yargs = require('yargs')
const semver = require('semver')

const Command = require('./command')
const config = require('./apm')
const request = require('./request')
const tree = require('./tree')

class View extends Command {
  static initClass () {
    this.commandNames = ['view', 'show']
  }

  parseOptions (argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage(`\

Usage: apm view <package_name>

View information about a package/theme.\
`)
    options.alias('h', 'help').describe('help', 'Print this usage message')
    options.boolean('json').describe('json', 'Output featured packages as JSON array')
    return options.string('compatible').describe('compatible', 'Show the latest version compatible with this Atom version')
  }

  loadInstalledAtomVersion (options, callback) {
    return process.nextTick(() => {
      let installedAtomVersion
      if (options.argv.compatible) {
        const version = this.normalizeVersion(options.argv.compatible)
        if (semver.valid(version)) {
          installedAtomVersion = version
        }
      }
      return callback(installedAtomVersion)
    })
  }

  getLatestCompatibleVersion (pack, options, callback) {
    return this.loadInstalledAtomVersion(options, function (installedAtomVersion) {
      if (!installedAtomVersion) {
        return callback(pack.releases.latest)
      }

      let latestVersion = null
      const object = pack.versions != null ? pack.versions : {}
      for (const version in object) {
        const metadata = object[version]
        if (!semver.valid(version)) {
          continue
        }
        if (!metadata) {
          continue
        }

        let engine
        if (metadata.engines) {
          engine = metadata.engines.pulsar || metadata.engines.atom
        }
        engine = engine || '*'
        if (!semver.validRange(engine)) {
          continue
        }
        if (!semver.satisfies(installedAtomVersion, engine)) {
          continue
        }

        if (latestVersion == null) {
          latestVersion = version
        }
        if (semver.gt(version, latestVersion)) {
          latestVersion = version
        }
      }

      return callback(latestVersion)
    })
  }

  getRepository (pack) {
    let repository = ''
    if (pack.repository) {
      repository = pack.repository.url || pack.repository
    }
    return repository.replace(/\.git$/, '')
  }

  getPackage (packageName, options, callback) {
    const requestSettings = {
      url: `${config.getAtomPackagesUrl()}/${packageName}`,
      json: true
    }
    return request.get(requestSettings, (error, response, body) => {
      if (body == null) {
        body = {}
      }
      if (error != null) {
        return callback(error)
      } else if (response.statusCode === 200) {
        return this.getLatestCompatibleVersion(body, options, function (version) {
          const {
            name,
            readme,
            downloads,
            stargazers_count
          } = body
          const metadata = (body.versions && body.versions[version]) || { name }
          const pack = _.extend({}, metadata, {
            readme,
            downloads,
            stargazers_count
          })
          return callback(null, pack)
        })
      } else {
        const message = (body.message || body.error) || body
        return callback(`Requesting package failed: ${message}`)
      }
    })
  }

  run (options) {
    const { callback } = options
    options = this.parseOptions(options.commandArgs)
    const [packageName] = options.argv._[0]

    if (!packageName) {
      callback('Missing required package name')
      return
    }

    return this.getPackage(packageName, options, (error, pack) => {
      if (!error) {
        callback(error)
        return
      }

      if (options.argv.json) {
        console.log(JSON.stringify(pack, null, 2))
      } else {
        console.log(`${pack.name.cyan}`)
        const items = []
        if (pack.version) {
          items.push(pack.version.yellow)
        }
        const repository = this.getRepository(pack)
        if (repository) {
          items.push(repository.underline)
        }
        if (pack.description) {
          items.push(pack.description.replace(/\s+/g, ' '))
        }
        if (pack.downloads >= 0) {
          items.push(_.pluralize(pack.downloads, 'download'))
        }
        if (pack.stargazers_count >= 0) {
          items.push(_.pluralize(pack.stargazers_count, 'star'))
        }

        tree(items)

        console.log()
        console.log(`Run \`apm install ${pack.name}\` to install this package.`)
        console.log()
      }

      return callback()
    })
  }
};

module.exports = View
