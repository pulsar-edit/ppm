describe('command help', () => {
  beforeEach(() => {
    spyOnToken();
    silenceOutput();
  });

  describe('apm help publish', () => {
    it('displays the help for the command', async () => {
      let callback = jasmine.createSpy('callback');
      await apmRun(['help', 'publish'], callback);
      expect(console.error.calls.count()).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).toBeUndefined();
    });
  });

  describe('apm publish -h', () => {
    it('displays the help for the command', async () => {
      let callback = jasmine.createSpy('callback');
      await apmRun(['publish', '-h'], callback);
      expect(console.error.calls.count()).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).toBeUndefined();
    });
  });

  describe('apm help', () => {
    it('displays the help for apm', async () => {
      let callback = jasmine.createSpy('callback');
      await apmRun(['help'], callback);
      expect(console.error.calls.count()).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).toBeUndefined();
    });
  });

  describe('apm', () => {
    it('displays the help for apm', async () => {
      let callback = jasmine.createSpy('callback');
      await apmRun([], callback);
      expect(console.error.calls.count()).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).toBeUndefined();
    });
  });
});
