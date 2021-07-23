{spawn} = require 'child_process'
path = require 'path'

_ = require 'underscore-plus'
colors = require 'colors'
npm = require 'npm'
yargs = require 'yargs'
wordwrap = require 'wordwrap'

# Enable "require" scripts in asar archives
require 'asar-require'

config = require './apm'
fs = require './fs'
import * as git from './git'

setupTempDirectory = ->
  temp = require 'temp'
  tempDirectory = require('os').tmpdir()
  # Resolve ~ in tmp dir atom/atom#2271
  tempDirectory = path.resolve(fs.absolute(tempDirectory))
  temp.dir = tempDirectory
  try
    fs.makeTreeSync(temp.dir)
  temp.track()

setupTempDirectory()

ciClass = -> require './ci'
cleanClass = -> require './clean'
configClass = -> require './config'
dedupClass  = -> require './dedupe'
developClass  = -> require './develop'
disableClass  = -> require './disable'
docsClass  = -> require './docs'
enableClass  = -> require './enable'
featuredClass  = -> require './featured'
initClass  = -> require './init'
installClass  = -> require './install'
linksClass  = -> require './links'
linkClass  = -> require './link'
listClass  = -> require './list'
loginClass  = -> require './login'
publishClass  = -> require './publish'
rebuildClass  = -> require './rebuild'
rebuildModuleCacheClass  = -> require './rebuild-module-cache'
searchClass  = -> require './search'
starClass  = -> require './star'
starsClass  = -> require './stars'
testClass  = -> require './test'
uninstallClass  = -> require './uninstall'
unlinkClass  = -> require './unlink'
unpublishClass  = -> require './unpublish'
unstarClass  = -> require './unstar'
upgradeClass  = -> require './upgrade'
viewClass  = -> require './view'

commands = {
  'ci': ciClass,
  'clean': cleanClass,
  'prune': cleanClass,
  'config': configClass,
  'dedupe': dedupClass,
  'dev': developClass,
  'develop': developClass,
  'disable': disableClass,
  'docs': docsClass,
  'home': docsClass,
  'open': docsClass,
  'enable': enableClass
  'featured': featuredClass
  'init': initClass,
  'install': installClass,
  'i': installClass,
  'link': linkClass,
  'ln': linkClass
  'linked': linksClass,
  'links': linksClass,
  'lns': linksClass,
  'list': listClass,
  'ls': listClass,
  'login': loginClass,
  'publish': publishClass,
  'rebuild-module-cache': rebuildModuleCacheClass,
  'rebuild': rebuildClass,
  'search': searchClass,
  'star': starClass,
  'stars': starsClass,
  'starred': starsClass
  'test': testClass
  'deinstall': uninstallClass,
  'delete': uninstallClass,
  'erase': uninstallClass,
  'remove': uninstallClass,
  'rm': uninstallClass,
  'uninstall': uninstallClass,
  'unlink': unlinkClass,
  'unpublish': unpublishClass,
  'unstar': unstarClass,
  'upgrade': upgradeClass,
  'outdated': upgradeClass,
  'update': upgradeClass,
  'view': viewClass,
  'show': viewClass,
}

parseOptions = (args=[]) ->
  options = yargs(args).wrap(Math.min(100, yargs.terminalWidth()))
  options.usage """

    apm - Atom Package Manager powered by https://atom.io

    Usage: apm <command>

    where <command> is one of:
    #{wordwrap(4, 80)(Object.keys(commands).sort().join(', '))}.

    Run `apm help <command>` to see the more details about a specific command.
  """
  options.alias('v', 'version').describe('version', 'Print the apm version')
  options.alias('h', 'help').describe('help', 'Print this usage message')
  options.boolean('color').default('color', true).describe('color', 'Enable colored output')
  options.command = options.argv._[0]
  for arg, index in args when arg is options.command
    options.commandArgs = args[index+1..]
    break
  options

showHelp = (options) ->
  return unless options?

  help = options.help()
  if help.indexOf('Options:') >= 0
    help += "\n  Prefix an option with `no-` to set it to false such as --no-color to disable"
    help += "\n  colored output."

  console.error(help)

printVersions = (args, callback) ->
  apmVersion =  require('../package.json').version ? ''
  npmVersion = require('npm/package.json').version ? ''
  nodeVersion = process.versions.node ? ''

  getPythonVersion (pythonVersion) ->
    git.getGitVersion (gitVersion) ->
      getAtomVersion (atomVersion) ->
        if args.json
          versions =
            apm: apmVersion
            npm: npmVersion
            node: nodeVersion
            atom: atomVersion
            python: pythonVersion
            git: gitVersion
            nodeArch: process.arch
          if config.isWin32()
            versions.visualStudio = config.getInstalledVisualStudioFlag()
          console.log JSON.stringify(versions)
        else
          pythonVersion ?= ''
          gitVersion ?= ''
          atomVersion ?= ''
          versions =  """
            #{'apm'.red}  #{apmVersion.red}
            #{'npm'.green}  #{npmVersion.green}
            #{'node'.blue} #{nodeVersion.blue} #{process.arch.blue}
            #{'atom'.cyan} #{atomVersion.cyan}
            #{'python'.yellow} #{pythonVersion.yellow}
            #{'git'.magenta} #{gitVersion.magenta}
          """

          if config.isWin32()
            visualStudioVersion = config.getInstalledVisualStudioFlag() ? ''
            versions += "\n#{'visual studio'.cyan} #{visualStudioVersion.cyan}"

          console.log versions
        callback()

getAtomVersion = (callback) ->
  config.getResourcePath (resourcePath) ->
    unknownVersion = 'unknown'
    try
      {version} = require(path.join(resourcePath, 'package.json')) ? unknownVersion
      callback(version)
    catch error
      callback(unknownVersion)

getPythonVersion = (callback) ->
  npmOptions =
    userconfig: config.getUserConfigPath()
    globalconfig: config.getGlobalConfigPath()
  npm.load npmOptions, ->
    python = npm.config.get('python') ? process.env.PYTHON
    if config.isWin32() and not python
      rootDir = process.env.SystemDrive ? 'C:\\'
      rootDir += '\\' unless rootDir[rootDir.length - 1] is '\\'
      pythonExe = path.resolve(rootDir, 'Python27', 'python.exe')
      python = pythonExe if fs.isFileSync(pythonExe)

    python ?= 'python'

    spawned = spawn(python, ['--version'])
    outputChunks = []
    spawned.stderr.on 'data', (chunk) -> outputChunks.push(chunk)
    spawned.stdout.on 'data', (chunk) -> outputChunks.push(chunk)
    spawned.on 'error', ->
    spawned.on 'close', (code) ->
      if code is 0
        [name, version] = Buffer.concat(outputChunks).toString().split(' ')
        version = version?.trim()
      callback(version)

module.exports =
  run: (args, callback) ->
    config.setupApmRcFile()
    options = parseOptions(args)

    unless options.argv.color
      colors.disable()

    callbackCalled = false
    options.callback = (error) ->
      return if callbackCalled
      callbackCalled = true
      if error?
        if _.isString(error)
          message = error
        else
          message = error.message ? error

        if message is 'canceled'
          # A prompt was canceled so just log an empty line
          console.log()
        else if message
          console.error(message.red)
      callback?(error)

    args = options.argv
    command = options.command
    if args.version
      printVersions(args, options.callback)
    else if args.help
      if Command = commands[options.command]?()
        showHelp(new Command().parseOptions?(options.command))
      else
        showHelp(options)
      options.callback()
    else if command
      if command is 'help'
        if Command = commands[options.commandArgs]?()
          showHelp(new Command().parseOptions?(options.commandArgs))
        else
          showHelp(options)
        options.callback()
      else if Command = commands[command]?()
        new Command().run(options)
      else
        options.callback("Unrecognized command: #{command}")
    else
      showHelp(options)
      options.callback()
