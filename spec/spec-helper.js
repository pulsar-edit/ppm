const auth = require('../src/auth');
const apm = require('../src/apm-cli');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

// A convenience function around `apm.run` that returns a `Promise`; this saves
// us from lots of boilerplate whenever we call `apm.run`.
//
// Providing a callback is only necessary if you want to test the arguments
// passed to the callback (via a Jasmine spy). This is arguably easier than
// capturing the return value of `apmRun`.
global.apmRun = async (args, dummyCallback) => {
  return new Promise((resolve) => {
    apm.run(args, (...args) => {
      dummyCallback?.(...args);
      resolve(args);
    });
  });
};

// A `Promise` wrapper around `setTimeout`.
async function wait (ms) {
  return new Promise(r => setTimeout(r, ms));
}

global.wait = wait;

// Suppresses the output of `apm` commands by mocking `console.log`,
// `console.error`, and the `write` methods of `process.stdout` and
// `process.stderr`.
//
// If you need to temporarily turn on output to help troubleshoot a spec
// failure, don't comment out the invocation; change it to
// `silenceOutput(true)` so that these methods remain mocked (and can therefore
// still be inspected by tests).
global.silenceOutput = (callThrough = false) => {
  spyOn(console, 'log');
  spyOn(console, 'error');
  spyOn(process.stdout, 'write');
  spyOn(process.stderr, 'write');

  if (callThrough) {
    const ref = [console.log, console.error, process.stdout.write, process.stderr.write];
    for (const spy of ref) {
      spy.and.callThrough();
    }
  }
};

// Never supply actual credentials in spec code.
global.spyOnToken = () => {
  spyOn(auth, 'getToken').and.callFake(
    () => Promise.resolve('token')
  );
};

// Given a condition, waits until the condition evaluates to `true`, waiting
// at least ten milliseconds after each check.
//
// Signatures:
//
// * waitsFor(description, timeoutMs, condition)
// * waitsFor(description, condition)
// * waitsFor(timeoutMs, condition)
// * waitsFor(condition)
//
// `condition` must be a function; all truthy return values count as successes,
// and all falsy return values count as failures.
//
// If `description` is given, it will be repeated in the error message thrown
// if the condition fails to be met within the timeout interval.
//
// If `timeoutMs` is omitted, it defaults to 5000 milliseconds.
global.waitsFor = async (...args) => {
  let description;
  if (typeof args[0] === 'string') {
    description = args.shift();
  }
  let timeoutMs = 5000;
  if (typeof args[0] === 'number') {
    timeoutMs = args.shift();
  }
  let [condition] = args;
  let start = Date.now();
  while (!condition()) {
    if ((Date.now() - start) > timeoutMs) {
      let message = `Condition not met after ${timeoutMs} milliseconds`;
      if (description) {
        message = `${message}: ${description}`;
      }
      throw new Error(message);
    }
    await wait(10);
  }
};
