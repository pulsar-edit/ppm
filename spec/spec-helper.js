const auth = require('../lib/auth');

global.silenceOutput = (callThrough = false) => {
  spyOn(console, 'log');
  spyOn(console, 'error');
  spyOn(process.stdout, 'write');
  spyOn(process.stderr, 'write');

  if (callThrough) {
    const ref = [console.log, console.error, process.stdout.write, process.stderr.write];
    for (const spy of ref) {
      spy.andCallThrough();
    }
  }
};

global.spyOnToken = () => spyOn(auth, 'getToken').andCallFake(callback => callback(null, 'token'));
