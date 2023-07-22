
let keytar;
try {
  keytar = require('keytar');
} catch (error) {
  // Gracefully handle keytar failing to load due to missing library on Linux
  if (process.platform === 'linux') {
    keytar = {
      findPassword() { return Promise.reject(); },
      setPassword() { return Promise.reject(); }
    };
  } else {
    throw error;
  }
}

const tokenName = 'pulsar-edit.dev Package API Token';

module.exports = {
  // Get the package API token from the keychain.
  //
  // callback - A function to call with an error as the first argument and a
  //            string token as the second argument.
  getToken(callback) {
    keytar.findPassword(tokenName)
      .then(function(token) {
        if (token) {
          return callback(null, token);
        } else {
          return Promise.reject();
        }}).catch(function() {
        let token;
        if ((token = process.env.ATOM_ACCESS_TOKEN)) {
          return callback(null, token);
        } else {
          return callback(`\
No package API token in keychain
Run \`ppm login\` or set the \`ATOM_ACCESS_TOKEN\` environment variable.\
`
          );
        }
    });
  },

  // Save the given token to the keychain.
  //
  // token - A string token to save.
  saveToken(token) {
    return keytar.setPassword(tokenName, 'pulsar-edit.dev', token);
  }
};
