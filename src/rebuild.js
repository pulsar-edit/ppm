
const path = require('path');

const _ = require('underscore-plus');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');
const Install = require('./install');

module.exports =
class Rebuild extends Command {
  static commandNames = [ "rebuild" ];

    constructor() {
      super();
      this.atomDirectory = config.getAtomDirectory();
      this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
      this.atomNpmPath = require.resolve('npm/bin/npm-cli');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm rebuild [<name> [<name> ...]]

Rebuild the given modules currently installed in the node_modules folder
in the current working directory.

All the modules will be rebuilt if no module names are specified.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    forkNpmRebuild(options, callback) {
      process.stdout.write('Rebuilding modules ');

      const rebuildArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'rebuild'];
      rebuildArgs.push(...this.getNpmBuildFlags());
      rebuildArgs.push(...options.argv._);

      fs.makeTreeSync(this.atomDirectory);

      const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: config.getRustupHomeDirPath()});
      this.addBuildEnvVars(env);

      return this.fork(this.atomNpmPath, rebuildArgs, {env}, callback);
    }

    run(options) {
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);

      config.loadNpm((error, npm) => {
        this.npm = npm;
        this.loadInstalledAtomMetadata(() => {
          this.forkNpmRebuild(options, (code, stderr) => {
            if (stderr == null) { stderr = ''; }
            if (code === 0) {
              this.logSuccess();
              return callback();
            } else {
              this.logFailure();
              return callback(stderr);
            }
          });
        });
      });
    }
  }
