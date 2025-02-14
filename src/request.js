
const npm = require("npm");
const superagent = require("superagent");
require("superagent-proxy")(superagent);

const config = require("./apm.js");

// request would not error on valid status codes, leaving the implementer to deal
// with specifics. But superagent will fail on anything 4xx, 5xx, and 3xx.
// So we have to specifically say these are valid, or otherwise redo a lot of our logic
const OK_STATUS_CODES = [200, 201, 204, 404];

function loadNpm() {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  return new Promise((resolve, reject) =>
    void npm.load(npmOptions, (error, value) => void(error != null ? reject(error) : resolve(value)))
  );
};

async function configureRequest(requestOptions){
  await loadNpm();
  requestOptions.proxy ??= npm.config.get("https-proxy") ?? npm.config.get("proxy") ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  requestOptions.strictSSL ??= npm.config.get("strict-ssl") ?? true;

  requestOptions.headers ??= {};
  requestOptions.headers["User-Agent"] ??= npm.config.get("user-agent") ?? `PulsarPpm/${require("../package.json").version}`;

  if (requestOptions.json) {
    requestOptions.headers["Accept"] = "application/json";
  }

  requestOptions.qs ??= {};
}

module.exports = {
  async get(opts) {
    await configureRequest(opts);
    const retryCount = opts.retries ?? 0;

    if (typeof opts.strictSSL === "boolean") {
      const res = await superagent
        .get(opts.url)
        .proxy(opts.proxy)
        .set(opts.headers)
        .query(opts.qs)
        .retry(retryCount)
        .disableTLSCerts()
        .ok((res) => OK_STATUS_CODES.includes(res.status));
      return res;
    }

    const res = await superagent
      .get(opts.url)
      .proxy(opts.proxy)
      .set(opts.headers)
      .query(opts.qs)
      .retry(retryCount)
      .ok((res) => OK_STATUS_CODES.includes(res.status));
    return res;
  },

  async del(opts) {
    await configureRequest(opts);
    if (typeof opts.strictSSL === "boolean") {
      const res = await superagent
        .delete(opts.url)
        .proxy(opts.proxy)
        .set(opts.headers)
        .query(opts.qs)
        .disableTLSCerts()
        .ok((res) => OK_STATUS_CODES.includes(res.status));
      return res;
    }

    const res = await superagent
      .delete(opts.url)
      .proxy(opts.proxy)
      .set(opts.headers)
      .query(opts.qs)
      .ok((res) => OK_STATUS_CODES.includes(res.status));
    return res;
  },

  async post(opts) {
    await configureRequest(opts);
    if (typeof opts.strictSSL === "boolean") {
      const res = await superagent
        .post(opts.url)
        .proxy(opts.proxy)
        .set(opts.headers)
        .query(opts.qs)
        .disableTLSCerts()
        .ok((res) => OK_STATUS_CODES.includes(res.status));
      return res;
    }

    const res = await superagent.post(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).ok((res) => OK_STATUS_CODES.includes(res.status));
    return res;
  },

  async createReadStream(opts) {
    await configureRequest(opts);
    if (typeof opts.strictSSL === "boolean") {
      return superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).disableTLSCerts().ok((res) => OK_STATUS_CODES.includes(res.status));
    } else {
      return superagent.get(opts.url).proxy(opts.proxy).set(opts.headers).query(opts.qs).ok((res) => OK_STATUS_CODES.includes(res.status));
    }
  },

  getErrorMessage(body, err) {
    if (err?.status === 503) {
      return `${err.response.req.host} is temporarily unavailable, please try again later.`;
    } else {
      let msg = err?.response?.body?.message ?? err?.response?.body ?? err?.response?.error ?? err ?? body.message ?? body.error ?? body;
      if (typeof msg === "object") {
        // If we found a message that's still an object lets make sure it'll
        // still be readable for users
        msg = JSON.stringify(msg);
      }
      return msg;
    }
  },

  debug(debug) {
    // Superagent does not support debug flags like request did
    return;
  }
};
