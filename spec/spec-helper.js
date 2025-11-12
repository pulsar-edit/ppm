const auth = require('../src/auth');
const apm = require('../src/apm-cli');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

global.apmRun = async (args, dummyCallback) => {
  return new Promise((resolve) => {
    apm.run(args, (...args) => {
      dummyCallback?.(...args);
      resolve(args);
    });
  });
};

async function wait (ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

global.spyOnToken = () => {
  spyOn(auth, 'getToken').and.callFake(
    () => Promise.resolve('token')
  );
};

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
