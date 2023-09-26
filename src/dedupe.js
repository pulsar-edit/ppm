
const path = require('path');

const async = require('async');
const _ = require('underscore-plus');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');

module.exports =
class Dedupe extends Command {
  static commandNames = [ "dedupe" ];

    constructor() {
      super();
      this.atomDirectory = config.getAtomDirectory();
      this.atomPackagesDirectory = path.join(this.atomDirectory, 'packages');
      this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
      this.atomNpmPath = require.resolve('npm/bin/npm-cli');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm dedupe [<package_name>...]

Reduce duplication in the node_modules folder in the current directory.

This command is experimental.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    dedupeModules(options, callback) {
      process.stdout.write('Deduping modules ');

      this.forkDedupeCommand(options, (...args) => {
        this.logCommandResults(...args).then(callback, callback);
      });
    }

    forkDedupeCommand(options, callback) {
      const dedupeArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'dedupe'];
      dedupeArgs.push(...this.getNpmBuildFlags());
      if (options.argv.silent) { dedupeArgs.push('--silent'); }
      if (options.argv.quiet) { dedupeArgs.push('--quiet'); }

      for (let packageName of Array.from(options.argv._)) { dedupeArgs.push(packageName); }

      fs.makeTreeSync(this.atomDirectory);

      const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: config.getRustupHomeDirPath()});
      this.addBuildEnvVars(env);

      const dedupeOptions = {env};
      if (options.cwd) { dedupeOptions.cwd = options.cwd; }

      return this.fork(this.atomNpmPath, dedupeArgs, dedupeOptions, callback);
    }

    createAtomDirectories() {
      fs.makeTreeSync(this.atomDirectory);
      return fs.makeTreeSync(this.atomNodeDirectory);
    }

    run(options) {
      const {callback, cwd} = options;
      options = this.parseOptions(options.commandArgs);
      options.cwd = cwd;

      this.createAtomDirectories();

      const commands = [];
      commands.push(callback => this.loadInstalledAtomMetadata().then(callback, callback));
      commands.push(callback => this.dedupeModules(options, callback));
      return async.waterfall(commands, callback);
    }
}
