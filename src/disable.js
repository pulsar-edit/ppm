
const _ = require('underscore-plus');
const path = require('path');
const CSON = require('season');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const List = require('./list');

module.exports =
class Disable extends Command {
  static commandNames = [ "disable" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm disable [<package_name>]...

Disables the named package(s).\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    async getInstalledPackages() {
      const options = {
        argv: {
          theme: false,
          bare: true
        }
      };

      const lister = new List();
      const corePackages = await lister.listBundledPackages(options);
      const devPackages = lister.listDevPackages(options);
      const userPackages = lister.listUserPackages(options);
      return corePackages.concat(devPackages, userPackages);
    }

    async run(options) {
        options = this.parseOptions(options.commandArgs);

        let packageNames = this.packageNamesFromArgv(options.argv);

        const configFilePath = CSON.resolve(path.join(config.getAtomDirectory(), 'config'));
        if (!configFilePath) {
          return 'Could not find config.cson. Run Pulsar first?'; //errors as return values atm
        }

        let settings;
        try {
          settings = CSON.readFileSync(configFilePath);
        } catch (error) {
          return `Failed to load \`${configFilePath}\`: ${error.message}`; //errors as return values atm
        }

        try {
          const installedPackages = await this.getInstalledPackages();
          const installedPackageNames = Array.from(installedPackages).map((pkg) => pkg.name);
          const notInstalledPackageNames = packageNames.filter(elem => !installedPackageNames.includes(elem));
          if (notInstalledPackageNames.length > 0) {
            console.log(`Not Installed:\n  ${notInstalledPackageNames.join('\n  ')}`);
          }

          // only installed packages can be disabled
          packageNames = packageNames.filter(elem => installedPackageNames.includes(elem));

          if (packageNames.length === 0) {
            return "Please specify a package to disable"; //errors as return values atm
          }

          const keyPath = '*.core.disabledPackages';
          const disabledPackages = _.valueForKeyPath(settings, keyPath) ?? [];
          const result = Array.from(new Set([...disabledPackages, ...packageNames]));
          _.setValueForKeyPath(settings, keyPath, result);

          try {
            CSON.writeFileSync(configFilePath, settings);
          } catch (error) {
            return `Failed to save \`${configFilePath}\`: ${error.message}`; //errors as return values atm
          }

          console.log(`Disabled:\n  ${packageNames.join('\n  ')}`);
          this.logSuccess();
        } catch (error) {
          return error; //errors as return values atm
        }
    }
  }
