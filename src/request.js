
const npm = require("npm");
const superagent = require("superagent");
require("superagent-proxy")(superagent);

const config = require("./apm.js");

const loadNpm = function(callback) {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  return npm.load(npmOptions, callback);
};

const configureRequest = (requestOptions, callback) => loadNpm(function() {
  requestOptions.proxy ??= npm.config.get("https-proxy") ?? npm.config.get("proxy") ?? process.env.HTTP_PROXY ?? process.env.HTTP_PROXY;
  requestOptions.strictSSL ??= npm.config.get("strict-ssl");

  requestOptions.headers ??= {};
  requestOptions.headers["User-Agent"] ??= npm.config.get("user-agent") ?? `PulsarPpm/${require("../package.json").version}`;

  if (requestOptions.json) {
    requestOptions.headers["Accept"] = "application/json";
  }

  requestOptions.qs ??= {};

  return callback();
});

module.exports = {
  get(opts, callback) {
    configureRequest(opts, () => {
      let retryCount = opts.retries ?? 0;

      if (typeof opts.strictSSL === "boolean") {
        superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).retry(retryCount).disableTLSCerts().then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      } else {
        superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).retry(retryCount).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      }
    });
  },

  del(opts, callback) {
    configureRequest(opts, () => {
      if (typeof opts.strictSSL === "boolean") {
        superagent.delete(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts().then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      } else {
        superagent.delete(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      }
    });
  },

  post(opts, callback) {
    configureRequest(opts, () => {
      if (typeof opts.strictSSL === "boolean") {
        superagent.post(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts().then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      } else {
        superagent.post(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      }
    });
  },

  createReadStream(requestOptions, callback) {
    configureRequest(opts, () => {
      if (typeof opts.strictSSL === "boolean") {
        return superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts();
      } else {
        return superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs);
      }
    });
  },

  getErrorMessage(err) {
    if (err?.status === 503) {
      return `${err.response.req.host} is temporarily unavailable, please try again later.`;
    } else {
      return err?.response?.body ?? err?.response?.error ?? err;
    }
  },

  debug(debug) {
    // Superagent does not support debug flags like request did
    return;
  }
};
