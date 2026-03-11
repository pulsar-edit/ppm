
const path = require('path');
const yargs = require('yargs');
const npmConfig = require('@npmcli/config');
const defs = require("@npmcli/config/lib/definitions");
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

    let configArgs = ['--globalconfig', apm.getGlobalConfigPath(), '--userconfig', apm.getUserConfigPath() ];

    const conf = new npmConfig({
      npmPath: "",
      definitions: {
        ...defs.definitions,
        // Define any default overrides
        cache: { ...defs.definitions.cache, default: path.join(process.env.ATOM_HOME, ".apm") }
      },
      shorthands: defs.shorthands,
      flatten: defs.flatten,
      argv: configArgs,
      env: {
        // TODO: Do we need to include anything else from the env?
        // previously used `...process.env` but it lead to lots of useless warnings
        HOME: this.atomNodeDirectory,
        RUSTUP_HOME: apm.getRustupHomeDirPath()
      }
    });

    // re-route process object log events to console
    process.on("log", (level, ...args) => {
      console.log(level, ...args);
    });

    return new Promise((resolve, reject) => {
      try {
      conf.load().then(() => {
        conf.validate();

        const action = options.argv._[0];
        const key = options.argv._[1];
        const value = options.argv._[2];

        if (action === "get") {
          console.log(conf.get(key));
          resolve();
        } else if (action === "set") {
          conf.set(key, value, "user");
          conf.save("user");
          resolve();
        } else if (action === "delete") {
          resolve(conf.delete(key));
        } else if (action === "list") {
          reject("TODO: 501");
        } else if (action === "edit") {
          reject("TODO: 501");
        }

      }).catch((err) => {
        console.error(err);
        reject(err);
      });
      } catch(err) { console.error(err); reject(err); }
    });

  }
}
