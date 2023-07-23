
const _ = require('underscore-plus');
const yargs = require('yargs');
const Q = require('q');
const read = require('read');
const open = require('open');

const auth = require('./auth');
const Command = require('./command');

module.exports =
class Login extends Command {
  static commandNames = [ "login" ];

    constructor(...args) {
      super(...args);
      this.welcomeMessage = this.welcomeMessage.bind(this);
      this.getToken = this.getToken.bind(this);
      this.saveToken = this.saveToken.bind(this);
    }

    static getTokenOrLogin(callback) {
      return auth.getToken(function(error, token) {
        if (error != null) {
          return new Login().run({callback, commandArgs: []});
        } else {
          return callback(null, token);
        }
      });
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

    run(options) {
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);
      return Q({token: options.argv.token})
        .then(this.welcomeMessage)
        .then(this.openURL)
        .then(this.getToken)
        .then(this.saveToken)
        .then(token => callback(null, token))
        .catch(callback);
    }

    prompt(options) {
      const readPromise = Q.denodeify(read);
      return readPromise(options);
    }

    welcomeMessage(state) {
      if (state.token) { return Q(state); }

      const welcome = `\
Welcome to Pulsar!

Before you can publish packages, you'll need an API token.

Visit your account page on pulsar-edit.dev ${'https://web.pulsar-edit.dev/users'.underline},
copy the token and paste it below when prompted.
\
`;
      console.log(welcome);

      return this.prompt({prompt: "Press [Enter] to open your account page."});
    }

    openURL(state) {
      if (state.token) { return Q(state); }

      return open('https://web.pulsar-edit.dev/users');
    }

    getToken(state) {
      if (state.token) { return Q(state); }

      return this.prompt({prompt: 'Token>', edit: true})
        .spread(function(token) {
          state.token = token;
          return Q(state);
      });
    }

    saveToken({token}) {
      if (!token) { throw new Error("Token is required"); }

      process.stdout.write('Saving token to Keychain ');
      auth.saveToken(token);
      this.logSuccess();
      return Q(token);
    }
  }
