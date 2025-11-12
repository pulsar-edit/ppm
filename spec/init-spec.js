const path = require('path');
const temp = require('temp');
const CSON = require('season');
const fs = require('../src/fs');

describe('apm init', () => {
  let languagePath, packagePath, themePath;

  beforeEach(() => {
    silenceOutput();
    spyOnToken();
    const currentDir = temp.mkdirSync('apm-init-');
    spyOn(process, 'cwd').and.returnValue(currentDir);
    packagePath = path.join(currentDir, 'fake-package');
    themePath = path.join(currentDir, 'fake-theme');
    languagePath = path.join(currentDir, 'language-fake');
    process.env.GITHUB_USER = 'somebody';
  });

  describe('when creating a package', () => {
    describe('when package syntax is CoffeeScript', () => {
      it('generates the proper file structure', async () => {
        await apmRun(['init', '--package', 'fake-package']);
        expect(fs.existsSync(packagePath)).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'keymaps'))).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'keymaps', 'fake-package.cson'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'lib'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'lib', 'fake-package-view.coffee'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'lib', 'fake-package.coffee'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'menus'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'menus', 'fake-package.cson'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'spec', 'fake-package-view-spec.coffee'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'spec', 'fake-package-spec.coffee'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'styles', 'fake-package.less'))
        ).toBeTruthy();
        expect(
          fs.existsSync(path.join(packagePath, 'package.json'))
        ).toBeTruthy();
        expect(
          JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'))).name
        ).toBe('fake-package');
        expect(
          JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'))).repository
        ).toBe('https://github.com/somebody/fake-package');
      });
    });

    describe('when package syntax is JavaScript', () => {
      it('generates the proper file structure', async () => {
        await apmRun(['init', '--syntax', 'javascript', '--package', 'fake-package']);
        expect(fs.existsSync(packagePath)).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'keymaps'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'keymaps', 'fake-package.json'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'lib'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'lib', 'fake-package-view.js'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'lib', 'fake-package.js'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'menus'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'menus', 'fake-package.json'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'spec', 'fake-package-view-spec.js'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'spec', 'fake-package-spec.js'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'styles', 'fake-package.less'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'package.json'))).toBeTruthy();
        expect(JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'))).name).toBe('fake-package');
        expect(JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'))).repository).toBe('https://github.com/somebody/fake-package');
      });
    });

    describe('when package syntax is unsupported', () => {
      it('logs an error', async () => {
        const callback = jasmine.createSpy('callback');
        await apmRun(['init', '--syntax', 'something-unsupported', '--package', 'fake-package'], callback);
        expect(callback.calls.argsFor(0)[0].length).toBeGreaterThan(0);
      });
    });

    describe('when converting a TextMate bundle', () => {
      beforeEach(async () => {
        const textMateBundlePath = path.join(__dirname, 'fixtures', 'r.tmbundle');
        await apmRun(['init', '--package', 'fake-package', '--convert', textMateBundlePath]);
      });

      it('generates the proper file structure', () => {
        expect(fs.existsSync(packagePath)).toBeTruthy();
        expect(fs.isFileSync(path.join(packagePath, 'settings', 'fake-package.cson'))).toBe(true);
        expect(fs.isFileSync(path.join(packagePath, 'snippets', 'fake-package.cson'))).toBe(true);
        expect(fs.isFileSync(path.join(packagePath, 'grammars', 'r.cson'))).toBe(true);
        expect(fs.existsSync(path.join(packagePath, 'command'))).toBeFalsy();
        expect(fs.existsSync(path.join(packagePath, 'README.md'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'package.json'))).toBeTruthy();
        expect(fs.existsSync(path.join(packagePath, 'LICENSE.md'))).toBeFalsy();
        expect(JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'))).name).toBe('fake-package');
        expect(JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'))).repository).toBe('https://github.com/somebody/fake-package');
        expect(CSON.readFileSync(path.join(packagePath, 'snippets', 'fake-package.cson'))['.source.rd.tm']['Attach']).toEqual({
          body: 'attach($1) *outlet',
          prefix: 'att'
        });
        expect(CSON.readFileSync(path.join(packagePath, 'settings', 'fake-package.cson'))['.source.r']['editor']).toEqual({
          foldEndPattern: '(^\\s*\\)|^\\s*\\})',
          commentStart: '# '
        });
      });

      it('unescapes escaped dollar signs `$` in snippets', () => {
        let forLoopBody = CSON.readFileSync(
          path.join(packagePath, 'snippets', 'fake-package.cson')
        )['.source.perl']['For Loop'].body;
        forLoopBody = forLoopBody.replace(/\r?\n/g, '\n');
        expect(forLoopBody).toBe('for (my $${1:var} = 0; $$1 < ${2:expression}; $$1++) {\n\t${3:# body...}\n}\n');
      });
    });
  });

  describe('when creating a theme', () => {
    it('generates the proper file structure', async () => {
      await apmRun(['init', '--theme', 'fake-theme']);
      expect(fs.existsSync(themePath)).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'styles'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'styles', 'colors.less'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'styles', 'syntax-variables.less'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'styles', 'syntax.less'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'styles', 'editor.less'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'index.less'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'README.md'))).toBeTruthy();
      expect(fs.existsSync(path.join(themePath, 'package.json'))).toBeTruthy();
      expect(JSON.parse(fs.readFileSync(path.join(themePath, 'package.json'))).name).toBe('fake-theme');
      expect(JSON.parse(fs.readFileSync(path.join(themePath, 'package.json'))).repository).toBe('https://github.com/somebody/fake-theme');
    });

    describe('when converting a TextMate theme', () => {
      it('generates the proper file structure', async () => {
        const textMateThemePath = path.join(__dirname, 'fixtures', 'Dawn.tmTheme');
        await apmRun(['init', '--theme', 'fake-theme', '--convert', textMateThemePath]);
        expect(fs.existsSync(themePath)).toBeTruthy();
        expect(fs.existsSync(path.join(themePath, 'styles'))).toBeTruthy();
        expect(fs.readFileSync(path.join(themePath, 'styles', 'syntax-variables.less'), 'utf8')).toContain('@syntax-gutter-text-color: #080808;\n@syntax-gutter-text-color-selected: #080808;\n@syntax-gutter-background-color: #F5F5F5;\n@syntax-gutter-background-color-selected: rgba(0, 108, 125, 0.07);');
        expect(fs.readFileSync(path.join(themePath, 'styles', 'base.less'), 'utf8')).toContain('@import "syntax-variables";\n\natom-text-editor {\n  background-color: @syntax-background-color;\n  color: @syntax-text-color;\n}\n\natom-text-editor .gutter {\n  background-color: @syntax-gutter-background-color;\n  color: @syntax-gutter-text-color;\n}');
        expect(fs.existsSync(path.join(themePath, 'README.md'))).toBeTruthy();
        expect(fs.existsSync(path.join(themePath, 'package.json'))).toBeTruthy();
        expect(fs.existsSync(path.join(themePath, 'LICENSE.md'))).toBeFalsy();
        expect(JSON.parse(fs.readFileSync(path.join(themePath, 'package.json'))).name).toBe('fake-theme');
        expect(JSON.parse(fs.readFileSync(path.join(themePath, 'package.json'))).repository).toBe('https://github.com/somebody/fake-theme');
      });

      it("logs an error if it doesn't have all the required color settings", async () => {
        const callback = jasmine.createSpy('callback');
        const textMateThemePath = path.join(__dirname, 'fixtures', 'Bad.tmTheme');
        await apmRun(['init', '--theme', 'fake-theme', '--convert', textMateThemePath], callback);
        expect(callback.calls.argsFor(0)[0].message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('when creating a language', () => {
    it('generates the proper file structure', async () => {
      await apmRun(['init', '--language', 'fake']);
      expect(fs.existsSync(languagePath)).toBeTruthy()
      expect(fs.existsSync(path.join(languagePath, 'grammars', 'fake.cson'))).toBeTruthy();
      expect(fs.existsSync(path.join(languagePath, 'settings', 'language-fake.cson'))).toBeTruthy();
      expect(fs.existsSync(path.join(languagePath, 'snippets', 'language-fake.cson'))).toBeTruthy();
      expect(fs.existsSync(path.join(languagePath, 'spec', 'language-fake-spec.coffee'))).toBeTruthy();
      expect(fs.existsSync(path.join(languagePath, 'package.json'))).toBeTruthy();
      expect(JSON.parse(fs.readFileSync(path.join(languagePath, 'package.json'))).name).toBe('language-fake');
      expect(JSON.parse(fs.readFileSync(path.join(languagePath, 'package.json'))).repository).toBe('https://github.com/somebody/language-fake');
    });

    it('does not add language prefix to name if already present', async () => {
      await apmRun(['init', '--language', 'language-fake']);
      expect(fs.existsSync(languagePath)).toBeTruthy();
    });
  });
});
