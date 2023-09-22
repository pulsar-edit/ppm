
const path = require('path');

const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');
const tree = require('./tree');

module.exports =
class Links extends Command {
  static promiseBased = true;
  static commandNames = [ "linked", "links", "lns" ];

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
      for (let directory of fs.list(directoryPath)) {
        const symlinkPath = path.join(directoryPath, directory);
        if (fs.isSymbolicLinkSync(symlinkPath)) { symlinks.push(symlinkPath); }
      }
      return symlinks;
    }

    logLinks(directoryPath) {
      const links = this.getSymlinks(directoryPath);
      console.log(`${directoryPath.cyan} (${links.length})`);
      tree(links, {emptyMessage: '(no links)'}, function(link) {
        let realpath;
        try {
          realpath = fs.realpathSync(link);
        } catch (error) {
          realpath = '???'.red;
        }
        return `${path.basename(link).yellow} -> ${realpath}`;
      });
    }

    async run(_options) {
      this.logLinks(this.devPackagesPath);
      this.logLinks(this.packagesPath);
    }
  }
