
const npm = require('npm');
const request = require('request');

const config = require('./apm');

const loadNpm = function(callback) {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  return npm.load(npmOptions, callback);
};

const configureRequest = (requestOptions, callback) => loadNpm(function() {
  let left;
  if (requestOptions.proxy == null) { requestOptions.proxy = npm.config.get('https-proxy') || npm.config.get('proxy') || process.env.HTTPS_PROXY || process.env.HTTP_PROXY; }
  if (requestOptions.strictSSL == null) { requestOptions.strictSSL = npm.config.get('strict-ssl'); }

  const userAgent = (left = npm.config.get('user-agent')) != null ? left : `AtomApm/${require('../package.json').version}`;
  if (requestOptions.headers == null) { requestOptions.headers = {}; }
  if (requestOptions.headers['User-Agent'] == null) { requestOptions.headers['User-Agent'] = userAgent; }
  return callback();
});

module.exports = {
  get(requestOptions, callback) {
    return configureRequest(requestOptions, function() {
      let retryCount = requestOptions.retries != null ? requestOptions.retries : 0;
      let requestsMade = 0;
      var tryRequest = function() {
        requestsMade++;
        return request.get(requestOptions, function(error, response, body) {
          if ((retryCount > 0) && ['ETIMEDOUT', 'ECONNRESET'].includes(error != null ? error.code : undefined)) {
            retryCount--;
            return tryRequest();
          } else {
            if ((error != null ? error.message : undefined) && (requestsMade > 1)) {
              error.message += ` (${requestsMade} attempts)`;
            }

            return callback(error, response, body);
          }
        });
      };
      return tryRequest();
    });
  },

  del(requestOptions, callback) {
    return configureRequest(requestOptions, () => request.del(requestOptions, callback));
  },

  post(requestOptions, callback) {
    return configureRequest(requestOptions, () => request.post(requestOptions, callback));
  },

  createReadStream(requestOptions, callback) {
    return configureRequest(requestOptions, () => callback(request.get(requestOptions)));
  },

  getErrorMessage(response, body) {
    if ((response != null ? response.statusCode : undefined) === 503) {
      return `${response.host} is temporarily unavailable, please try again later.`;
    } else {
      return body?.message ?? body?.error ?? body;
    }
  },

  debug(debug) {
    return request.debug = debug;
  }
};
