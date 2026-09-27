const path = require('path');
const fsPromises = require('fs/promises');
const temp = require('temp');
const fs = require('../src/fs');

describe('fs', () => {
  describe('mv', () => {
    let sourceRoot, destinationRoot;

    beforeEach(() => {
      sourceRoot = temp.mkdirSync('apm-mv-source-');
      destinationRoot = temp.mkdirSync('apm-mv-destination-');
    });

    // Simulates a move across filesystems, where `rename(2)` fails.
    function stubCrossDeviceRename() {
      spyOn(fsPromises, 'rename').and.callFake(async () => {
        throw Object.assign(
          new Error('EXDEV: cross-device link not permitted'),
          { code: 'EXDEV' }
        );
      });
    }

    it('moves a file', async () => {
      const source = path.join(sourceRoot, 'file.txt');
      const destination = path.join(destinationRoot, 'nested', 'file.txt');
      await fsPromises.writeFile(source, 'contents');

      await fs.mv(source, destination);

      expect(fs.existsSync(source)).toBe(false);
      expect(await fsPromises.readFile(destination, 'utf8')).toBe('contents');
    });

    it('replaces an existing destination', async () => {
      const source = path.join(sourceRoot, 'file.txt');
      const destination = path.join(destinationRoot, 'file.txt');
      await fsPromises.writeFile(source, 'new');
      await fsPromises.writeFile(destination, 'old');

      await fs.mv(source, destination);

      expect(await fsPromises.readFile(destination, 'utf8')).toBe('new');
    });

    describe('when the destination is on a different filesystem', () => {
      beforeEach(() => stubCrossDeviceRename());

      it('copies a file and removes the original', async () => {
        const source = path.join(sourceRoot, 'file.txt');
        const destination = path.join(destinationRoot, 'nested', 'file.txt');
        await fsPromises.writeFile(source, 'contents');

        await fs.mv(source, destination);

        expect(fsPromises.rename).toHaveBeenCalled();
        expect(fs.existsSync(source)).toBe(false);
        expect(await fsPromises.readFile(destination, 'utf8')).toBe('contents');
      });

      if (process.platform !== 'win32') {
        it("preserves the file's mode", async () => {
          const source = path.join(sourceRoot, 'node');
          const destination = path.join(destinationRoot, 'node');
          await fsPromises.writeFile(source, '#!/bin/sh\n');
          await fsPromises.chmod(source, 0o755);

          await fs.mv(source, destination);

          const { mode } = await fsPromises.stat(destination);
          expect(mode & 0o777).toBe(0o755);
        });

        it('moves a directory, leaving symlinks untouched', async () => {
          const source = path.join(sourceRoot, 'dir');
          const destination = path.join(destinationRoot, 'dir');
          await fsPromises.mkdir(path.join(source, 'sub'), { recursive: true });
          await fsPromises.writeFile(path.join(source, 'sub', 'file.txt'), 'contents');
          await fsPromises.symlink(path.join('sub', 'file.txt'), path.join(source, 'link'));

          await fs.mv(source, destination);

          expect(fs.existsSync(source)).toBe(false);
          expect(
            await fsPromises.readFile(path.join(destination, 'sub', 'file.txt'), 'utf8')
          ).toBe('contents');
          expect(
            await fsPromises.readlink(path.join(destination, 'link'))
          ).toBe(path.join('sub', 'file.txt'));
        });
      }
    });

    it('rethrows errors other than EXDEV', async () => {
      spyOn(fsPromises, 'rename').and.callFake(async () => {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      });
      const source = path.join(sourceRoot, 'file.txt');
      const destination = path.join(destinationRoot, 'file.txt');
      await fsPromises.writeFile(source, 'contents');

      await expectAsync(fs.mv(source, destination)).toBeRejectedWith(
        jasmine.objectContaining({ code: 'EACCES' })
      );
      expect(fs.existsSync(source)).toBe(true);
      expect(fs.existsSync(destination)).toBe(false);
    });
  });
});
