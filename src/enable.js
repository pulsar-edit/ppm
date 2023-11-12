
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

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      let packageNames = this.packageNamesFromArgv(options.argv);

      const configFilePath = CSON.resolve(path.join(config.getAtomDirectory(), 'config'));
      if (!configFilePath) {
        return "Could not find config.cson. Run Pulsar first?"; //errors as retval atm
      }

      let settings;
      try {
        settings = CSON.readFileSync(configFilePath);
      } catch (error) {
        return `Failed to load \`${configFilePath}\`: ${error.message}`; //errors as retval atm
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
        return "Please specify a package to enable"; //errors as retval atm
      }

      const result = _.difference(disabledPackages, packageNames);
      _.setValueForKeyPath(settings, keyPath, result);

      try {
        CSON.writeFileSync(configFilePath, settings);
      } catch (error) {
        return `Failed to save \`${configFilePath}\`: ${error.message}`; //errors as retval atm
      }

      console.log(`Enabled:\n  ${packageNames.join('\n  ')}`);
      this.logSuccess();
    }
  }
