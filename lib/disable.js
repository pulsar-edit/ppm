/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Disable;
const _ = require('underscore-plus');
const path = require('path');
const CSON = require('season');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const List = require('./list');

module.exports =
(Disable = (function() {
  Disable = class Disable extends Command {
    static initClass() {
      this.commandNames = ['disable'];
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: apm disable [<package_name>]...

Disables the named package(s).\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    getInstalledPackages(callback) {
      const options = {
        argv: {
          theme: false,
          bare: true
        }
      };

      const lister = new List();
      return lister.listBundledPackages(options, (error, core_packages) => lister.listDevPackages(options, (error, dev_packages) => lister.listUserPackages(options, (error, user_packages) => callback(null, core_packages.concat(dev_packages, user_packages)))));
    }

    run(options) {
      let settings;
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);

      let packageNames = this.packageNamesFromArgv(options.argv);

      const configFilePath = CSON.resolve(path.join(config.getAtomDirectory(), 'config'));
      if (!configFilePath) {
        callback("Could not find config.cson. Run Atom first?");
        return;
      }

      try {
        settings = CSON.readFileSync(configFilePath);
      } catch (error1) {
        const error = error1;
        callback(`Failed to load \`${configFilePath}\`: ${error.message}`);
        return;
      }

      return this.getInstalledPackages((error, installedPackages) => {
        let left;
        if (error) { return callback(error); }

        const installedPackageNames = (Array.from(installedPackages).map((pkg) => pkg.name));

        // uninstalledPackages = (name for name in packageNames when !installedPackageNames[name])
        const uninstalledPackageNames = _.difference(packageNames, installedPackageNames);
        if (uninstalledPackageNames.length > 0) {
          console.log(`Not Installed:\n  ${uninstalledPackageNames.join('\n  ')}`);
        }

        // only installed packages can be disabled
        packageNames = _.difference(packageNames, uninstalledPackageNames);

        if (packageNames.length === 0) {
          callback("Please specify a package to disable");
          return;
        }

        const keyPath = '*.core.disabledPackages';
        const disabledPackages = (left = _.valueForKeyPath(settings, keyPath)) != null ? left : [];
        const result = _.union(disabledPackages, packageNames);
        _.setValueForKeyPath(settings, keyPath, result);

        try {
          CSON.writeFileSync(configFilePath, settings);
        } catch (error2) {
          error = error2;
          callback(`Failed to save \`${configFilePath}\`: ${error.message}`);
          return;
        }

        console.log(`Disabled:\n  ${packageNames.join('\n  ')}`);
        this.logSuccess();
        return callback();
      });
    }
  };
  Disable.initClass();
  return Disable;
})());
