
const _ = require('underscore-plus');
const path = require('path');
const CSON = require('season');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');

module.exports =
class Enable extends Command {
  static commandNames = [ "enable" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm enable [<package_name>]...

Enables the named package(s).\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    run(options) {
      return new Promise((resolve, _reject) => {
        let settings;
        options = this.parseOptions(options.commandArgs);
        let packageNames = this.packageNamesFromArgv(options.argv);

        const configFilePath = CSON.resolve(path.join(config.getAtomDirectory(), 'config'));
        if (!configFilePath) {
          resolve("Could not find config.cson. Run Atom first?");
          return;
        }

        try {
          settings = CSON.readFileSync(configFilePath);
        } catch (error) {
          resolve(`Failed to load \`${configFilePath}\`: ${error.message}`);
          return;
        }

        const keyPath = '*.core.disabledPackages';
        const disabledPackages = _.valueForKeyPath(settings, keyPath) ?? [];

        const errorPackages = _.difference(packageNames, disabledPackages);
        if (errorPackages.length > 0) {
          console.log(`Not Disabled:\n  ${errorPackages.join('\n  ')}`);
        }

        // can't enable a package that isn't disabled
        packageNames = _.difference(packageNames, errorPackages);

        if (packageNames.length === 0) {
          resolve("Please specify a package to enable");
          return;
        }

        const result = _.difference(disabledPackages, packageNames);
        _.setValueForKeyPath(settings, keyPath, result);

        try {
          CSON.writeFileSync(configFilePath, settings);
        } catch (error) {
          resolve(`Failed to save \`${configFilePath}\`: ${error.message}`);
          return;
        }

        console.log(`Enabled:\n  ${packageNames.join('\n  ')}`);
        this.logSuccess();
        resolve();
      });
    }
  }
