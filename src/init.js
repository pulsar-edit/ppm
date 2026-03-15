
const path = require('path');

const yargs = require('yargs');

const Command = require('./command');
const fs = require('./fs');

module.exports =
class Init extends Command {
  static commandNames = [ "init" ];

  constructor() {
    super();
    // Keep `coffeescript` as a supported option, but do not advertise it.
    //
    // The first item in this list will be the default language if one is not
    // opted into via `-s`/`--syntax`.
    this.supportedSyntaxes = ["javascript", "typescript", "coffeescript"];
  }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));

      options.usage(`\
Usage:
  ppm init -p <package-name>
  ppm init -p <package-name> --syntax <javascript-or-typescript>
  ppm init -p <package-name> -c ~/Downloads/r.tmbundle
  ppm init -p <package-name> -c https://github.com/textmate/r.tmbundle
  ppm init -p <package-name> --template /path/to/your/package/template

  ppm init -t <theme-name>
  ppm init -t <theme-name> -c ~/Downloads/Dawn.tmTheme
  ppm init -t <theme-name> -c https://raw.github.com/chriskempson/tomorrow-theme/master/textmate/Tomorrow-Night-Eighties.tmTheme
  ppm init -t <theme-name> --template /path/to/your/theme/template

  ppm init -l <language-name>

Generates code scaffolding for either a theme or package depending
on the option selected.\
`
      );
      options.alias('p', 'package').string('package').describe('package', 'Generates a basic package');
      options.alias('s', 'syntax').string('syntax').describe('syntax', 'Sets package syntax to JavaScript or TypeScript (applies only to -p/--package option)');
      options.alias('t', 'theme').string('theme').describe('theme', 'Generates a basic theme');
      options.alias('l', 'language').string('language').describe('language', 'Generates a basic language package');
      options.alias('c', 'convert').string('convert').describe('convert', 'Path or URL to TextMate bundle/theme to convert');
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.string('template').describe('template', 'Path to the package or theme template');
    }

    async run(options) {
      let templatePath;
      options = this.parseOptions(options.commandArgs);
      if (options.argv.package?.length > 0) {
        if (options.argv.convert) {
          return this.convertPackage(
            options.argv.convert,
            options.argv.package
            // Treat the error as a value for the time being.
          ).catch(error => error);
        }
        const packagePath = path.resolve(options.argv.package);
        const syntax = options.argv.syntax || this.supportedSyntaxes[0];
        if (!Array.from(this.supportedSyntaxes).includes(syntax)) {
          // Expose the error value as a value for now.
          return `You must specify one of ${this.supportedSyntaxes.join(', ')} after the --syntax argument`;
        }
        templatePath = this.getTemplatePath(options.argv, `package-${syntax}`);
        await this.generateFromTemplate(packagePath, templatePath);
        return;
      }
      if (options.argv.theme?.length > 0) {
        if (options.argv.convert) {
          // Rewiring errors...
          return this.convertTheme(options.argv.convert, options.argv.theme).catch(error => error);
        }
        const themePath = path.resolve(options.argv.theme);
        templatePath = this.getTemplatePath(options.argv, 'theme');
        await this.generateFromTemplate(themePath, templatePath);
        return;
      }
      if (options.argv.language?.length > 0) {
        let languagePath = path.resolve(options.argv.language);
        const languageName = path.basename(languagePath).replace(/^language-/, '');
        languagePath = path.join(path.dirname(languagePath), `language-${languageName}`);
        templatePath = this.getTemplatePath(options.argv, 'language');
        await this.generateFromTemplate(languagePath, templatePath, languageName);
        return;
      }
      // If we get this far, something about this command was invalid.
      if (options.argv.package != null) {
        // Errors as values...
        return 'You must specify a path after the --package argument';
      }
      if (options.argv.theme != null) {
        // Errors as values...
        return 'You must specify a path after the --theme argument';
      }
      // Errors as values...
      return 'You must specify either --package, --theme or --language to `ppm init`';
    }

    async convertPackage(sourcePath, destinationPath) {
      if (!destinationPath) {
        throw "Specify directory to create package in using --package";
      }

      const PackageConverter = require('./package-converter');
      const converter = new PackageConverter(sourcePath, destinationPath);
      await converter.convert();
      destinationPath = path.resolve(destinationPath);
      const templatePath = path.resolve(__dirname, '..', 'templates', 'bundle');
      await this.generateFromTemplate(destinationPath, templatePath);
    }

    async convertTheme(sourcePath, destinationPath) {
      if (!destinationPath) {
        throw "Specify directory to create theme in using --theme";
      }

      const ThemeConverter = require('./theme-converter');
      const converter = new ThemeConverter(sourcePath, destinationPath);
      await converter.convert();
      destinationPath = path.resolve(destinationPath);
      const templatePath = path.resolve(__dirname, '..', 'templates', 'theme');
      await this.generateFromTemplate(destinationPath, templatePath);
      fs.removeSync(path.join(destinationPath, 'styles', 'colors.less'));
      fs.removeSync(path.join(destinationPath, 'LICENSE.md'));
    }

    async generateFromTemplate(packagePath, templatePath, packageName) {
      packageName ??= path.basename(packagePath);
      const packageAuthor = process.env.GITHUB_USER || 'atom';

      fs.makeTreeSync(packagePath);

      for (let childPath of Array.from(await fs.listRecursive(templatePath))) {
        const templateChildPath = path.resolve(templatePath, childPath);
        let relativePath = templateChildPath.replace(templatePath, "");
        relativePath = relativePath.replace(/^\//, '');

        // Files with `.template` extensions typically are named that way
        // because they need part of their name replaced. Most other files that
        // aren't named based on a parameter can omit the `.template`
        // extension, even if their contents are partially parameterized.
        relativePath = relativePath.replace(/\.template$/, '');
        relativePath = this.replacePackageNamePlaceholders(relativePath, packageName);

        const sourcePath = path.join(packagePath, relativePath);
        if (fs.existsSync(sourcePath)) { continue; }
        if (fs.isDirectorySync(templateChildPath)) {
          fs.makeTreeSync(sourcePath);
        } else if (fs.isFileSync(templateChildPath)) {
          fs.makeTreeSync(path.dirname(sourcePath));
          let contents = fs.readFileSync(templateChildPath).toString();
          contents = this.replacePackageNamePlaceholders(contents, packageName);
          contents = this.replacePackageAuthorPlaceholders(contents, packageAuthor);
          contents = this.replaceCurrentYearPlaceholders(contents);
          fs.writeFileSync(sourcePath, contents);
        }
      }
    }

    replacePackageAuthorPlaceholders(string, packageAuthor) {
      return string.replace(/__package-author__/g, packageAuthor);
    }

    replacePackageNamePlaceholders(string, packageName) {
      const placeholderRegex = /__(?:(package-name)|([pP]ackageName)|(package_name))__/g;
      return string = string.replace(placeholderRegex, (_match, dash, camel, underscore) => {
        if (dash) {
          return this.dasherize(packageName);
        }
        if (camel) {
          if (/[a-z]/.test(camel[0])) {
            packageName = packageName[0].toLowerCase() + packageName.slice(1);
          } else if (/[A-Z]/.test(camel[0])) {
            packageName = packageName[0].toUpperCase() + packageName.slice(1);
          }
          return this.camelize(packageName);
        }
        if (underscore) {
          return this.underscore(packageName);
        }
      });
    }

    replaceCurrentYearPlaceholders(string) {
      return string.replace('__current_year__', new Date().getFullYear());
    }

    getTemplatePath(argv, templateType) {
      return argv.template != null ? path.resolve(argv.template) : path.resolve(__dirname, '..', 'templates', templateType);
    }

    dasherize(string) {
      string = string[0].toLowerCase() + string.slice(1);
      return string.replace(/([A-Z])|(_)/g, (_m, letter, _underscore) => letter ? "-" + letter.toLowerCase() : "-");
    }

    camelize(string) {
      return string.replace(/[_-]+(\w)/g, m => m[1].toUpperCase());
    }

    underscore(string) {
      string = string[0].toLowerCase() + string.slice(1);
      return string.replace(/([A-Z])|(-)/g, (_m, letter, _dash) => letter ? "_" + letter.toLowerCase() : "_");
    }
  }
