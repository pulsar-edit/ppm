/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Links;
const path = require('path');

const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');
const tree = require('./tree');

module.exports =
(Links = (function() {
  Links = class Links extends Command {
    static initClass() {
      this.commandNames = ['linked', 'links', 'lns'];
    }

    constructor() {
      super();
      this.devPackagesPath = path.join(config.getAtomDirectory(), 'dev', 'packages');
      this.packagesPath = path.join(config.getAtomDirectory(), 'packages');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm links

List all of the symlinked atom packages in ~/.atom/packages and
~/.pulsar/dev/packages.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    getDevPackagePath(packageName) { return path.join(this.devPackagesPath, packageName); }

    getPackagePath(packageName) { return path.join(this.packagesPath, packageName); }

    getSymlinks(directoryPath) {
      const symlinks = [];
      for (let directory of Array.from(fs.list(directoryPath))) {
        const symlinkPath = path.join(directoryPath, directory);
        if (fs.isSymbolicLinkSync(symlinkPath)) { symlinks.push(symlinkPath); }
      }
      return symlinks;
    }

    logLinks(directoryPath) {
      const links = this.getSymlinks(directoryPath);
      console.log(`${directoryPath.cyan} (${links.length})`);
      return tree(links, {emptyMessage: '(no links)'}, function(link) {
        let realpath;
        try {
          realpath = fs.realpathSync(link);
        } catch (error) {
          realpath = '???'.red;
        }
        return `${path.basename(link).yellow} -> ${realpath}`;
      });
    }

    run(options) {
      const {callback} = options;

      this.logLinks(this.devPackagesPath);
      this.logLinks(this.packagesPath);
      return callback();
    }
  };
  Links.initClass();
  return Links;
})());
