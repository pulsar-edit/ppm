/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const auth = require('../lib/auth.js');

global.silenceOutput = function(callThrough) {
  if (callThrough == null) { callThrough = false; }
  spyOn(console, 'log');
  spyOn(console, 'error');
  spyOn(process.stdout, 'write');
  spyOn(process.stderr, 'write');

  if (callThrough) {
    return ([
      console.log,
      console.error,
      process.stdout.write,
      process.stderr.write
    ]).map((spy) => spy.andCallThrough());
  }
};

global.spyOnToken = () => spyOn(auth, 'getToken').andCallFake(callback => callback(null, 'token'));
