path = require 'path'
_ = require 'underscore-plus'
yargs = require 'yargs'
apm = require './apm'
Command = require './command'

module.exports =
class Config extends Command
  @commandNames: ['config']

  constructor: ->
    super()
    atomDirectory = apm.getAtomDirectory()
    @atomNodeDirectory = path.join(atomDirectory, '.node-gyp')
    @atomNpmPath = require.resolve('npm/bin/npm-cli')

  parseOptions: (argv) ->
    options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage """

      Usage: ppm config set <key> <value>
             ppm config get <key>
             ppm config delete <key>
             ppm config list
             ppm config edit

    """
    options.alias('h', 'help').describe('help', 'Print this usage message')

  run: (options) ->
    {callback} = options
    options = @parseOptions(options.commandArgs)

    configArgs = ['--globalconfig', apm.getGlobalConfigPath(), '--userconfig', apm.getUserConfigPath(), 'config']
    configArgs = configArgs.concat(options.argv._)

    env = _.extend({}, process.env, {HOME: @atomNodeDirectory, RUSTUP_HOME: apm.getRustupHomeDirPath()})
    configOptions = {env}

    @fork @atomNpmPath, configArgs, configOptions, (code, stderr='', stdout='') ->
      if code is 0
        process.stdout.write(stdout) if stdout
        callback()
      else
        process.stdout.write(stderr) if stderr
        callback(new Error("npm config failed: #{code}"))
