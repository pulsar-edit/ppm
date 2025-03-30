
const yargs = require('yargs');
const { read } = require('read');
const open = require('open');

const auth = require('./auth');
const Command = require('./command');

module.exports =
class Login extends Command {
  static commandNames = [ "login" ];

    static async getTokenOrLogin() {
      try {
        const token = await auth.getToken();
        return token;
      } catch (error) {
        return await new Login().obtainToken();
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

    async obtainToken(offeredToken) {
      let token = offeredToken;
      if (token == null) {
        await this.welcomeMessage();
        await this.openURL();
        token = await this.getToken();
      }
      await this.saveToken(token);
      return token;
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      try {
        await this.obtainToken(options.argv.token);
      } catch (error) {
        return error; //errors as return values atm
      }
    }

    prompt(options) {
      return read(options);
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
