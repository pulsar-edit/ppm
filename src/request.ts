/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import npm from "npm"
import request, { Options, RequestCallback } from "request"
import * as config from "./apm"

function loadNpm(callback: Parameters<typeof npm["load"]>[0]) {
  npm.config.defs.defaults.userconfig = config.getUserConfigPath()
  npm.config.defs.defaults.globalconfig = config.getGlobalConfigPath()
  return npm.load(callback)
}

function configureRequest(requestOptions: Options, callback: () => void) {
  return loadNpm(function () {
    let left
    if (requestOptions.proxy == null) {
      requestOptions.proxy =
        npm.config.get("https-proxy") || npm.config.get("proxy") || process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    }
    if (requestOptions.strictSSL == null) {
      requestOptions.strictSSL = npm.config.get("strict-ssl")
    }

    const userAgent =
      (left = npm.config.get("user-agent")) != null ? left : `AtomApm/${require("../package.json").version}`
    if (requestOptions.headers == null) {
      requestOptions.headers = {}
    }
    if (requestOptions.headers["User-Agent"] == null) {
      requestOptions.headers["User-Agent"] = userAgent
    }
    return callback()
  })
}

export function get(requestOptions: Options & { retries?: number }, callback: RequestCallback) {
  return configureRequest(requestOptions, function () {
    let retryCount = "retries" in requestOptions ? requestOptions.retries : 0
    let requestsMade = 0
    const tryRequest = function () {
      requestsMade++
      return request.get(requestOptions, function (error, response, body) {
        if (retryCount > 0 && ["ETIMEDOUT", "ECONNRESET"].includes(error?.code)) {
          retryCount--
          return tryRequest()
        } else {
          if (error?.message && requestsMade > 1) {
            error.message += ` (${requestsMade} attempts)`
          }

          return callback(error, response, body)
        }
      })
    }
    return tryRequest()
  })
}

export function del(requestOptions: Options, callback: RequestCallback) {
  return configureRequest(requestOptions, () => request.del(requestOptions, callback))
}

export function post(requestOptions: Options, callback: RequestCallback) {
  return configureRequest(requestOptions, () => request.post(requestOptions, callback))
}

export function createReadStream(
  requestOptions: Options,
  callback: { (readStream: any): any; (arg0: request.Request): void }
) {
  return configureRequest(requestOptions, () => callback(request.get(requestOptions)))
}

export function getErrorMessage(response: request.Response, body: {} | { repository?: { url?: string } }) {
  if (response?.statusCode === 503) {
    return "atom.io is temporarily unavailable, please try again later."
  } else {
    let left
    return (left = body?.message != null ? body?.message : body?.error) != null ? left : body
  }
}

export function debug(debug: boolean) {
  return (request.debug = debug)
}
