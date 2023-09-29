
const path = require('path');
const async = require('async');
const yargs = require('yargs');
const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');

module.exports =
class RebuildModuleCache extends Command {
  static promiseBased = true;
  static commandNames = [ "rebuild-module-cache" ];

    constructor() {
      super();
      this.atomPackagesDirectory = path.join(config.getAtomDirectory(), 'packages');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm rebuild-module-cache

Rebuild the module cache for all the packages installed to
~/.pulsar/packages

You can see the state of the module cache for a package by looking
at the _atomModuleCache property in the package's package.json file.

This command skips all linked packages.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    async getResourcePath() {
      if (!this.resourcePath) {
        const resourcePath = await config.getResourcePath();
        this.resourcePath = resourcePath;
        return this.resourcePath;
      }

      return new Promise((resolve, _reject) =>
        void process.nextTick(() => resolve(this.resourcePath))
      );
    }

    async rebuild(packageDirectory) {
      const resourcePath = await this.getResourcePath();
      this.moduleCache ??= require(path.join(resourcePath, 'src', 'module-cache'));
      this.moduleCache.create(packageDirectory);
    }

    async run(_options) {
      const commands = [];
      fs.list(this.atomPackagesDirectory).forEach(packageName => {
        const packageDirectory = path.join(this.atomPackagesDirectory, packageName);
        if (fs.isSymbolicLinkSync(packageDirectory)) { return; }
        if (!fs.isFileSync(path.join(packageDirectory, 'package.json'))) { return; }

        commands.push(async () => {
          process.stdout.write(`Rebuilding ${packageName} module cache `);
          try {
            await this.rebuild(packageDirectory);
            this.logSuccess();
          } catch (error) {
            this.logFailure();
            console.error(error);
            throw error;
          }
        });
      });

      try {
        await async.waterfall(commands);
      } catch (error) {
        return error; //errors as return values atm
      }
    }
  }
