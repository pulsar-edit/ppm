
const path = require('path');

const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');

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
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    forkNpmRebuild(options) {
      process.stdout.write('Rebuilding modules ');

      const rebuildArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'rebuild'];
      rebuildArgs.push(...this.getNpmBuildFlags());
      rebuildArgs.push(...options.argv._);

      fs.makeTreeSync(this.atomDirectory);

      const env = {
        ...process.env,
        HOME: this.atomNodeDirectory,
        RUSTUP_HOME: config.getRustupHomeDirPath()
      };
      this.addBuildEnvVars(env);

      return new Promise((resolve, reject) =>
        void this.fork(this.atomNpmPath, rebuildArgs, {env}, (code, stderr) => {
          if (code !== 0) {
            reject(stderr ?? `Unknown error while invoking npm: code ${code}`);
            return;
          }

          resolve();
        })
      );
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);

      const npm = await config.loadNpm();
      this.npm = npm;
      try {
        await this.loadInstalledAtomMetadata();
        await this.forkNpmRebuild(options);
        this.logSuccess();
      } catch (error) {
        this.logFailure();
        return error; // errors as return values atm
      }
    }
  }
