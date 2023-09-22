
const npm = require("npm");
const superagent = require("superagent");
require("superagent-proxy")(superagent);

const config = require("./apm.js");

// request would not error on valid status codes, leaving the implementer to deal
// with specifics. But superagent will fail on anything 4xx, 5xx, and 3xx.
// So we have to specifically say these are valid, or otherwise redo a lot of our logic
const OK_STATUS_CODES = [200, 201, 204, 404];

const loadNpm = function(callback) {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  return npm.load(npmOptions, callback);
};

const configureRequest = (requestOptions, callback) => loadNpm(function() {
  requestOptions.proxy ??= npm.config.get("https-proxy") ?? npm.config.get("proxy") ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  requestOptions.strictSSL ??= npm.config.get("strict-ssl") ?? true;

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
        superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).retry(retryCount).disableTLSCerts().ok((res) => OK_STATUS_CODES.includes(res.status)).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      } else {
        superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).retry(retryCount).ok((res) => OK_STATUS_CODES.includes(res.status)).then((res) => {
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
        superagent.delete(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts().ok((res) => OK_STATUS_CODES.includes(res.status)).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      } else {
        superagent.delete(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).ok((res) => OK_STATUS_CODES.includes(res.status)).then((res) => {
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
        superagent.post(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts().ok((res) => OK_STATUS_CODES.includes(res.status)).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      } else {
        superagent.post(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).ok((res) => OK_STATUS_CODES.includes(res.status)).then((res) => {
          return callback(null, res, res.body);
        }).catch((err) => {
          return callback(err, null, null);
        });
      }
    });
  },

  createReadStream(opts) {
    configureRequest(opts, () => {
      if (typeof opts.strictSSL === "boolean") {
        return superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts().ok((res) => OK_STATUS_CODES.includes(res.status));
      } else {
        return superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).ok((res) => OK_STATUS_CODES.includes(res.status));
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
