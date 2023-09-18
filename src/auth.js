
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
  // returns the token as string or throws an exception
  async getToken() {
    try {
      const token = await keytar.findPassword(tokenName);
      if (token) {
        return token;
      }
      
      return Promise.reject();
    } catch {
      const token = process.env.ATOM_ACCESS_TOKEN;
      if (token) {
        return token;
      }

      throw `\
No package API token in keychain
Run \`ppm login\` or set the \`ATOM_ACCESS_TOKEN\` environment variable.\
`;
    }
  },

  // Save the given token to the keychain.
  //
  // token - A string token to save.
  saveToken(token) {
    return keytar.setPassword(tokenName, 'pulsar-edit.dev', token);
  }
};
