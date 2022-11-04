let keytar;
try {
  keytar = require('keytar');
} catch (error) {
  // Gracefully handle keytar failing to load due to missing library on Linux
  if (process.platform !== 'linux') throw error;
  keytar = {
    findPassword: () => Promise.reject(),
    setPassword: () => Promise.reject()
  };
}

const tokenName = 'Atom.io API Token';

module.exports = {
  // Get the package API token from the keychain.
  //
  // callback - A function to call with an error as the first argument and a
  //            string token as the second argument.
  getToken(callback) {
    keytar.findPassword(tokenName).then( token => {
      if (token) {
        callback(null, token);
      } else {
        return Promise.reject();
      }
    })["catch"]( () => {
      const token = process.env.ATOM_ACCESS_TOKEN;
      if (token) {
        callback(null, token);
      } else {
        callback("No package API token in keychain\nRun `apm login` or set the `ATOM_ACCESS_TOKEN` environment variable.");
      }
    });
  },
  // Save the given token to the keychain.
  //
  // token - A string token to save.
  saveToken: token => keytar.setPassword(tokenName, 'atom.io', token)
};
