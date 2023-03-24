path = require 'path'

CSON = require 'season'
yargs = require 'yargs'

Command = require './command'
config = require './apm'
fs = require './fs'

module.exports =
class Unlink extends Command
  @commandNames: ['unlink']

  constructor: ->
    super()
    @devPackagesPath = path.join(config.getAtomDirectory(), 'dev', 'packages')
    @packagesPath = path.join(config.getAtomDirectory(), 'packages')

  parseOptions: (argv) ->
    options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage """

      Usage: ppm unlink [<package_path>]

      Delete the symlink in ~/.pulsar/packages for the package. The package in the
      current working directory is unlinked if no path is given.

      Run `ppm links` to view all the currently linked packages.
    """
    options.alias('h', 'help').describe('help', 'Print this usage message')
    options.alias('d', 'dev').boolean('dev').describe('dev', 'Unlink package from ~/.pulsar/dev/packages')
    options.boolean('hard').describe('hard', 'Unlink package from ~/.pulsar/packages and ~/.pulsar/dev/packages')
    options.alias('a', 'all').boolean('all').describe('all', 'Unlink all packages in ~/.pulsar/packages and ~/.pulsar/dev/packages')

  getDevPackagePath: (packageName) -> path.join(@devPackagesPath, packageName)

  getPackagePath: (packageName) -> path.join(@packagesPath, packageName)

  unlinkPath: (pathToUnlink) ->
    try
      process.stdout.write "Unlinking #{pathToUnlink} "
      fs.unlinkSync(pathToUnlink)
      @logSuccess()
    catch error
      @logFailure()
      throw error

  unlinkAll: (options, callback) ->
    try
      for child in fs.list(@devPackagesPath)
        packagePath = path.join(@devPackagesPath, child)
        @unlinkPath(packagePath) if fs.isSymbolicLinkSync(packagePath)
      unless options.argv.dev
        for child in fs.list(@packagesPath)
          packagePath = path.join(@packagesPath, child)
          @unlinkPath(packagePath) if fs.isSymbolicLinkSync(packagePath)
      callback()
    catch error
      callback(error)

  unlinkPackage: (options, callback) ->
    packagePath = options.argv._[0]?.toString() ? '.'
    linkPath = path.resolve(process.cwd(), packagePath)

    try
      packageName = CSON.readFileSync(CSON.resolve(path.join(linkPath, 'package'))).name
    packageName = path.basename(linkPath) unless packageName

    if options.argv.hard
      try
        @unlinkPath(@getDevPackagePath(packageName))
        @unlinkPath(@getPackagePath(packageName))
        callback()
      catch error
        callback(error)
    else
      if options.argv.dev
        targetPath = @getDevPackagePath(packageName)
      else
        targetPath = @getPackagePath(packageName)
      try
        @unlinkPath(targetPath)
        callback()
      catch error
        callback(error)

  run: (options) ->
    {callback} = options
    options = @parseOptions(options.commandArgs)

    if options.argv.all
      @unlinkAll(options, callback)
    else
      @unlinkPackage(options, callback)
