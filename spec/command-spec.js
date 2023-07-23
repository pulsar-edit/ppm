const Command = require('../src/command');

describe('Command', () => {
  describe('::spawn', () => {
    it('only calls the callback once if the spawned program fails', () => {
      let exited = false, callbackCount = 0;
      const command = new Command();
      const child = command.spawn('thisisafakecommand', [], () => {
        callbackCount++;
      });
      child.once('close', () => {
        exited = true;
      });
      waitsFor(() => exited);
      runs(() => {
        expect(callbackCount).toEqual(1);
      });
    });
  });
});
