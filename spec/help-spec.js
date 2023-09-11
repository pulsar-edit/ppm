const apm = require('../src/apm-cli');

describe('command help', () => {
  beforeEach(() => {
    spyOnToken();
    silenceOutput();
  });

  describe('apm help publish', () => {
    it('displays the help for the command', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['help', 'publish'], callback);
      waitsFor('waiting for help to complete', 60000, () => callback.callCount === 1);
      runs(() => {
        expect(console.error.callCount).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).toBeUndefined();
      });
    });
  });

  describe('apm publish -h', () => {
    it('displays the help for the command', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['publish', '-h'], callback);
      waitsFor('waiting for help to complete', 60000, () => callback.callCount === 1);
      runs(() => {
        expect(console.error.callCount).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).toBeUndefined();
      });
    });
  });

  describe('apm help', () => {
    it('displays the help for apm', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['help'], callback);
      waitsFor('waiting for help to complete', 60000, () => callback.callCount === 1);
      runs(() => {
        expect(console.error.callCount).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).toBeUndefined();
      });
    });
  });

  describe('apm', () => {
    it('displays the help for apm', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run([], callback);
      waitsFor('waiting for help to complete', 60000, () => callback.callCount === 1);
      runs(() => {
        expect(console.error.callCount).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).toBeUndefined();
      });
    });
  });
});
