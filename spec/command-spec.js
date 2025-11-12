const Command = require('../src/command');

describe('Command', () => {
  describe('::spawn', () => {
    it('only calls the callback once if the spawned program fails', async () => {
      let callbackCount = 0;
      const command = new Command();
      await new Promise((resolve) => {
        const child = command.spawn('thisisafakecommand', [], () => {
          callbackCount++;
        });
        child.once('close', resolve);
      })
      expect(callbackCount).toEqual(1);
    });
  });
});
