child_process = require 'child_process'
fs = require './fs'
path = require 'path'
npm = require 'npm'
semver = require 'semver'
asarPath = null

module.exports =
  getHomeDirectory: ->
    if process.platform is 'win32' then process.env.USERPROFILE else process.env.HOME

  getAtomDirectory: ->
    process.env.ATOM_HOME ? path.join(@getHomeDirectory(), '.pulsar')

  getRustupHomeDirPath: ->
    if process.env.RUSTUP_HOME
      process.env.RUSTUP_HOME
    else
      path.join(@getHomeDirectory(), '.multirust')

  getCacheDirectory: ->
    path.join(@getAtomDirectory(), '.apm')

  getResourcePath: (callback) ->
    if process.env.ATOM_RESOURCE_PATH
      return process.nextTick -> callback(process.env.ATOM_RESOURCE_PATH)

    if asarPath # already calculated
      return process.nextTick -> callback(asarPath)

    apmFolder = path.resolve(__dirname, '..')
    appFolder = path.dirname(apmFolder)
    if path.basename(apmFolder) is 'ppm' and path.basename(appFolder) is 'app'
      asarPath = "#{appFolder}.asar"
      if fs.existsSync(asarPath)
        return process.nextTick -> callback(asarPath)

    apmFolder = path.resolve(__dirname, '..', '..', '..')
    appFolder = path.dirname(apmFolder)
    if path.basename(apmFolder) is 'ppm' and path.basename(appFolder) is 'app'
      asarPath = "#{appFolder}.asar"
      if fs.existsSync(asarPath)
        return process.nextTick -> callback(asarPath)

    switch process.platform
      when 'darwin'
        child_process.exec 'mdfind "kMDItemCFBundleIdentifier == \'dev.pulsar-edit.pulsar\'"', (error, stdout='', stderr) ->
          [appLocation] = stdout.split('\n') unless error
          appLocation = '/Applications/Pulsar.app' unless appLocation
          asarPath = "#{appLocation}/Contents/Resources/app.asar"
          return process.nextTick -> callback(asarPath)
      when 'linux'
        asarPath = '/opt/Pulsar/resources/app.asar'
        return process.nextTick -> callback(asarPath)
      when 'win32'
        asarPath = "/Users/#{process.env.USERNAME}/AppData/Local/Programs/Pulsar/resources/app.asar"
        unless fs.existsSync(asarPath)
          asarPath = "/Program Files/Pulsar/resources/app.asar"
        return process.nextTick -> callback(asarPath)
      else
        return process.nextTick -> callback('')

  getReposDirectory: ->
    process.env.ATOM_REPOS_HOME ? path.join(@getHomeDirectory(), 'github')

  getElectronUrl: ->
    process.env.ATOM_ELECTRON_URL ? 'https://artifacts.electronjs.org/headers/dist'

  getAtomPackagesUrl: ->
    process.env.ATOM_PACKAGES_URL ? "#{@getAtomApiUrl()}/packages"

  getAtomApiUrl: ->
    process.env.ATOM_API_URL ? 'https://api.pulsar-edit.dev/api'

  getElectronArch: ->
    switch process.platform
      when 'darwin' then 'x64'
      else process.env.ATOM_ARCH ? process.arch

  getUserConfigPath: ->
    path.resolve(@getAtomDirectory(), '.apmrc')

  getGlobalConfigPath: ->
    path.resolve(@getAtomDirectory(), '.apm', '.apmrc')

  isWin32: ->
    process.platform is 'win32'

  x86ProgramFilesDirectory: ->
    process.env["ProgramFiles(x86)"] or process.env["ProgramFiles"]

  getInstalledVisualStudioFlag: ->
    return null unless @isWin32()

    # Use the explictly-configured version when set
    return process.env.GYP_MSVS_VERSION if process.env.GYP_MSVS_VERSION

    return '2019' if @visualStudioIsInstalled("2019")
    return '2017' if @visualStudioIsInstalled("2017")
    return '2015' if @visualStudioIsInstalled("14.0")

  visualStudioIsInstalled: (version) ->
    if version < 2017
      fs.existsSync(path.join(@x86ProgramFilesDirectory(), "Microsoft Visual Studio #{version}", "Common7", "IDE"))
    else
      fs.existsSync(path.join(@x86ProgramFilesDirectory(), "Microsoft Visual Studio", "#{version}", "BuildTools", "Common7", "IDE")) or fs.existsSync(path.join(@x86ProgramFilesDirectory(), "Microsoft Visual Studio", "#{version}", "Community", "Common7", "IDE")) or fs.existsSync(path.join(@x86ProgramFilesDirectory(), "Microsoft Visual Studio", "#{version}", "Enterprise", "Common7", "IDE")) or fs.existsSync(path.join(@x86ProgramFilesDirectory(), "Microsoft Visual Studio", "#{version}", "Professional", "Common7", "IDE")) or fs.existsSync(path.join(@x86ProgramFilesDirectory(), "Microsoft Visual Studio", "#{version}", "WDExpress", "Common7", "IDE"))

  loadNpm: (callback) ->
    npmOptions =
      userconfig: @getUserConfigPath()
      globalconfig: @getGlobalConfigPath()
    npm.load npmOptions, -> callback(null, npm)

  getSetting: (key, callback) ->
    @loadNpm -> callback(npm.config.get(key))

  setupApmRcFile: ->
    try
      fs.writeFileSync @getGlobalConfigPath(), """
        ; This file is auto-generated and should not be edited since any
        ; modifications will be lost the next time any apm command is run.
        ;
        ; You should instead edit your .apmrc config located in ~/.pulsar/.apmrc
        cache = #{@getCacheDirectory()}
        ; Hide progress-bar to prevent npm from altering apm console output.
        progress = false
      """
