
const path = require('path');
const yargs = require('yargs');
const apm = require('./apm');
const Command = require('./command');

module.exports =
class Config extends Command {
  static commandNames = [ "config" ];

  constructor() {
    super();
    const atomDirectory = apm.getAtomDirectory();
    this.atomNodeDirectory = path.join(atomDirectory, '.node-gyp');
    this.atomNpmPath = require.resolve('npm/bin/npm-cli');
  }

  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
    options.usage(`\

Usage: ppm config set <key> <value>
       ppm config get <key>
       ppm config delete <key>
       ppm config list
       ppm config edit
\
`
    );
    return options.alias('h', 'help').describe('help', 'Print this usage message');
  }

  run(options) {
    options = this.parseOptions(options.commandArgs);

    return new Promise(async (resolve, reject) => {
      try {
        const npmConf = await apm.getNpmConfig();

        const action = options.argv._[0];
        const key = options.argv._[1];
        const value = options.argv._[2];

        if (action === "get") {
          console.log(npmConf.get(key));
          resolve();
        } else if (action === "set") {
          npmConf.set(key, value, "user");
          npmConf.save("user");
          resolve();
        } else if (action === "delete") {
          resolve(npmConf.delete(key));
        } else if (action === "list") {
          reject("TODO: 501");
        } else if (action === "edit") {
          reject("TODO: 501");
        }
      } catch(err) {
        console.error(err);
        return err;
      }
    });

  }
}
