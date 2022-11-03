let keytar;
try {
  keytar = require('keytar');
} catch (error) {
  if (process.platform !== 'linux') throw error;
  keytar = {
    findPassword: () => Promise.reject(),
    setPassword: () => Promise.reject()
  };
}

const tokenName = 'Atom.io API Token';

module.exports = {
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
  saveToken: token => keytar.setPassword(tokenName, 'atom.io', token)
};
