const child_process = require('child_process');
const path = require('path');
const temp = require('temp');

describe('apm test', () => {
  let specPath;

  beforeEach(() => {
    silenceOutput();
    spyOnToken();

    const currentDir = temp.mkdirSync('apm-init-');
    spyOn(process, 'cwd').and.returnValue(currentDir);
    specPath = path.join(currentDir, 'spec');
  });

  it('calls atom to test', async () => {
    const atomSpawn = spyOn(child_process, 'spawn').and.returnValue({
      stdout: {
        on() {}
      },
      stderr: {
        on() {}
      },
      on(eventName, callback) {
        // Simulate the successful completion of the spawned process.
        if (eventName === 'close') {
          setTimeout(callback, 100, 0);
        }
      },
      removeListener() {}
    });
    await apmRun(['test']);

    // On Windows, there's a suffix (pulsar.cmd), so we only check that pulsar
    // is _included_ in the path.
    expect(atomSpawn.calls.mostRecent().args[0].indexOf('pulsar')).not.toBe(-1);
    expect(atomSpawn.calls.mostRecent().args[1][0]).toEqual('--dev');
    expect(atomSpawn.calls.mostRecent().args[1][1]).toEqual('--test');
    expect(atomSpawn.calls.mostRecent().args[1][2]).toEqual(specPath);
    if (process.platform !== 'win32') {
      expect(atomSpawn.calls.mostRecent().args[2].streaming).toBeTruthy();
    }
  });

  describe('returning', () => {
    let callback;

    const returnWithCode = async (type, code) => {
      callback = jasmine.createSpy('callback');
      const pulsarReturnFn = (e, fn) => e === type && fn(code);
      spyOn(child_process, 'spawn').and.returnValue({
        stdout: {
          on() {}
        },
        stderr: {
          on() {}
        },
        on: pulsarReturnFn,
        removeListener() {}
      }); // no op
      await apmRun(['test'], callback);
    };

    describe('successfully', () => {
      beforeEach(async () => await returnWithCode('close', 0));

      it('prints success', () => {
        expect(callback).toHaveBeenCalled();
        expect(callback.calls.mostRecent().args[0]).toBeUndefined();
        expect(process.stdout.write.calls.mostRecent().args[0]).toEqual('Tests passed\n'.green);
      });
    });

    describe('with a failure', () => {
      beforeEach(async () => await returnWithCode('close', 1));

      it('prints failure', () => {
        expect(callback).toHaveBeenCalled();
        expect(callback.calls.mostRecent().args[0]).toEqual('Tests failed');
      });
    });

    describe('with an error', () => {
      beforeEach(async () => await returnWithCode('error'));

      it('prints failure', () => {
        expect(callback).toHaveBeenCalled();
        expect(callback.calls.mostRecent().args[0]).toEqual('Tests failed');
      });
    });
  });
});
