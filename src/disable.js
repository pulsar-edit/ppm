
const _ = require('underscore-plus');
const path = require('path');
const CSON = require('season');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const List = require('./list');

module.exports =
class Disable extends Command {
  static promiseBased = true;
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

    getInstalledPackages() {
      const options = {
        argv: {
          theme: false,
          bare: true
        }
      };

      const lister = new List();
      return new Promise((resolve, _reject) => 
        void lister.listBundledPackages(options, (_error, core_packages) => 
          void lister.listDevPackages(options, (_error, dev_packages) =>
            void lister.listUserPackages(options, (_error, user_packages) =>
              void resolve(core_packages.concat(dev_packages, user_packages))
            )
          )
        )
      );
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

        return void this.getInstalledPackages().then(installedPackages => {
          

          const installedPackageNames = (Array.from(installedPackages).map((pkg) => pkg.name));

          // uninstalledPackages = (name for name in packageNames when !installedPackageNames[name])
          const uninstalledPackageNames = _.difference(packageNames, installedPackageNames);
          if (uninstalledPackageNames.length > 0) {
            console.log(`Not Installed:\n  ${uninstalledPackageNames.join('\n  ')}`);
          }

          // only installed packages can be disabled
          packageNames = _.difference(packageNames, uninstalledPackageNames);

          if (packageNames.length === 0) {
            resolve("Please specify a package to disable");
            return;
          }

          const keyPath = '*.core.disabledPackages';
          const disabledPackages = _.valueForKeyPath(settings, keyPath) ?? [];
          const result = _.union(disabledPackages, packageNames);
          _.setValueForKeyPath(settings, keyPath, result);

          try {
            CSON.writeFileSync(configFilePath, settings);
          } catch (error) {
            resolve(`Failed to save \`${configFilePath}\`: ${error.message}`);
            return;
          }

          console.log(`Disabled:\n  ${packageNames.join('\n  ')}`);
          this.logSuccess();
          resolve();
        }, error => void resolve(error));
      });
    }
  }
