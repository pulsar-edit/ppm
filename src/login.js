
const _ = require('underscore-plus');
const yargs = require('yargs');
const read = require('read');
const open = require('open');

const auth = require('./auth');
const Command = require('./command');

module.exports =
class Login extends Command {
  static commandNames = [ "login" ];

    constructor(...args) {
      super(...args);
    }

    static async getTokenOrLogin() {
      try {
        const token = await auth.getToken();
        return token;
      } catch (error) {
        return new Promise((resolve, reject) => 
          void new Login().run({callback: (error, value) => void(error != null ? reject(error) : resolve(value)), commandArgs: []})
        );
      }
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));

      options.usage(`\
Usage: ppm login

Enter your package API token and save it to the keychain. This token will
be used to identify you when publishing packages.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.string('token').describe('token', 'Package API token');
    }

    async run(options) {
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);
      let token = options.argv.token;

      try {
        if (token == null) {
          await this.welcomeMessage();
          await this.openURL();
          token = await this.getToken();
        }
        await this.saveToken(token);
        callback(null, token);
      } catch (error) {
        callback(error);
      }
    }

    prompt(options) {
      return new Promise((resolve, reject) =>
        void read(options, (error, answer) =>
          error != null
          ? void reject(error)
          : void resolve(answer)
        )
      );
    }

    async welcomeMessage() {

      const welcome = `\
Welcome to Pulsar!

Before you can publish packages, you'll need an API token.

Visit your account page on pulsar-edit.dev ${'https://web.pulsar-edit.dev/users'.underline},
copy the token and paste it below when prompted.
\
`;
      console.log(welcome);

      await this.prompt({prompt: "Press [Enter] to open your account page."});
    }

    async openURL() {
      await open('https://web.pulsar-edit.dev/users');
    }

    async getToken() {
      const token = await this.prompt({prompt: 'Token>', edit: true});
      return token;
    }

    async saveToken(token) {
      if (!token) { throw new Error("Token is required"); }

      process.stdout.write('Saving token to Keychain ');
      await auth.saveToken(token);
      this.logSuccess();
    }
  }
