
const path = require('path');
const url = require('url');
const zlib = require('zlib');

const _ = require('underscore-plus');
const CSON = require('season');
const plist = require('plist');
const {ScopeSelector, ready} = require('second-mate');
const tar = require('tar');
const temp = require('temp');

const fs = require('./fs');
const request = require('./request');

// Convert a TextMate bundle to an Atom package
module.exports =
class PackageConverter {
  constructor(sourcePath, destinationPath) {
    this.sourcePath = sourcePath;
    this.destinationPath = path.resolve(destinationPath);

    this.plistExtensions = [
      '.plist',
      '.tmCommand',
      '.tmLanguage',
      '.tmMacro',
      '.tmPreferences',
      '.tmSnippet'
    ];

    this.directoryMappings = {
      'Preferences': 'settings',
      'Snippets': 'snippets',
      'Syntaxes': 'grammars'
    };
  }

  async convert() {
    const {protocol} = url.parse(this.sourcePath);
    if ((protocol === 'http:') || (protocol === 'https:')) {
      await this.downloadBundle();
      return;
    }

    await this.copyDirectories(this.sourcePath);
  }

  getDownloadUrl() {
    let downloadUrl = this.sourcePath;
    downloadUrl = downloadUrl.replace(/(\.git)?\/*$/, '');
    return downloadUrl += '/archive/master.tar.gz';
  }

  async downloadBundle() {
    const tempPath = temp.mkdirSync('atom-bundle-');
    const requestOptions = {url: this.getDownloadUrl()};
    const readStream = await request.createReadStream(requestOptions);
    return new Promise((resolve, reject) => {
      readStream.on('response', ({headers, statusCode}) => {
        if (statusCode !== 200) {
          reject(`Download failed (${headers.status})`);
        }
      });
    
      readStream.pipe(zlib.createGunzip()).pipe(tar.extract({cwd: tempPath}))
        .on('error', error => reject(error))
        .on('end', async () => {
          const sourcePath = path.join(tempPath, fs.readdirSync(tempPath)[0]);
          await this.copyDirectories(sourcePath);
          resolve();
      });
    });
  }

  async copyDirectories(sourcePath) {
    let packageName;
    sourcePath = path.resolve(sourcePath);
    try {
      packageName = JSON.parse(fs.readFileSync(path.join(sourcePath, 'package.json')))?.packageName;
    } catch (error) {}
    packageName ??= path.basename(this.destinationPath);

    await this.convertSnippets(packageName, sourcePath);
    await this.convertPreferences(packageName, sourcePath);
    this.convertGrammars(sourcePath);
  }

  filterObject(object) {
    delete object.uuid;
    delete object.keyEquivalent;
  }

  convertSettings(settings) {
    if (settings.shellVariables) {
      const shellVariables = {};
      for (let {name, value} of Array.from(settings.shellVariables)) {
        shellVariables[name] = value;
      }
      settings.shellVariables = shellVariables;
    }

    const editorPropertyEntries = Object.entries({
      commentStart: _.valueForKeyPath(settings, 'shellVariables.TM_COMMENT_START'),
      commentEnd: _.valueForKeyPath(settings, 'shellVariables.TM_COMMENT_END'),
      increaseIndentPattern: settings.increaseIndentPattern,
      decreaseIndentPattern: settings.decreaseIndentPattern,
      foldEndPattern: settings.foldingStopMarker,
      completions: settings.completions
    }).filter(([_, value]) => value != null);
    if (editorPropertyEntries.length > 0) { return {editor: Object.fromEntries(editorPropertyEntries)}; }
  }

  readFileSync(filePath) {
    if (this.plistExtensions.includes(path.extname(filePath))) {
      return plist.parse(fs.readFileSync(filePath, 'utf8'));
    } else if (['.json', '.cson'].includes(path.extname(filePath))) {
      return CSON.readFileSync(filePath);
    }
  }

  writeFileSync(filePath, object) {
    object ??= {};
    this.filterObject(object);
    if (Object.keys(object).length > 0) {
      CSON.writeFileSync(filePath, object);
    }
  }

  convertFile(sourcePath, destinationDir) {
    const extension = path.extname(sourcePath);
    let destinationName = `${path.basename(sourcePath, extension)}.cson`;
    destinationName = destinationName.toLowerCase();
    const destinationPath = path.join(destinationDir, destinationName);

    let contents;
    if (this.plistExtensions.includes(path.extname(sourcePath))) {
      contents = plist.parse(fs.readFileSync(sourcePath, 'utf8'));
    } else if (['.json', '.cson'].includes(path.extname(sourcePath))) {
      contents = CSON.readFileSync(sourcePath);
    }

    this.writeFileSync(destinationPath, contents);
  }

  normalizeFilenames(directoryPath) {
    if (!fs.isDirectorySync(directoryPath)) { return; }

    const result = [];
    for (let child of Array.from(fs.readdirSync(directoryPath))) {
      const childPath = path.join(directoryPath, child);

      // Invalid characters taken from http://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx
      let convertedFileName = child.replace(/[|?*<>:"\\\/]+/g, '-');
      if (child === convertedFileName) { continue; }

      convertedFileName = convertedFileName.replace(/[\s-]+/g, '-');
      let convertedPath = path.join(directoryPath, convertedFileName);
      let suffix = 1;
      while (fs.existsSync(convertedPath) || fs.existsSync(convertedPath.toLowerCase())) {
        const extension = path.extname(convertedFileName);
        convertedFileName = `${path.basename(convertedFileName, extension)}-${suffix}${extension}`;
        convertedPath = path.join(directoryPath, convertedFileName);
        suffix++;
      }
      result.push(fs.renameSync(childPath, convertedPath));
    }
    return result;
  }

  async convertSnippets(packageName, source) {
    let sourceSnippets = path.join(source, 'snippets');
    if (!fs.isDirectorySync(sourceSnippets)) {
      sourceSnippets = path.join(source, 'Snippets');
    }
    if (!fs.isDirectorySync(sourceSnippets)) { return; }

    const snippetsBySelector = {};
    for (let child of Array.from(fs.readdirSync(sourceSnippets))) {
      const snippet = this.readFileSync(path.join(sourceSnippets, child)) ?? {};
      let {scope, name, content, tabTrigger} = snippet;
      if (!tabTrigger || !content) { continue; }

      // Replace things like '${TM_C_POINTER: *}' with ' *'
      content = content.replace(/\$\{TM_[A-Z_]+:([^}]+)}/g, '$1');

      // Replace things like '${1:${TM_FILENAME/(\\w+)*/(?1:$1:NSObject)/}}'
      // with '$1'
      content = content.replace(/\$\{(\d)+:\s*\$\{TM_[^}]+\s*\}\s*\}/g, '$$1');

      // Unescape escaped dollar signs $
      content = content.replace(/\\\$/g, '$');

      if (name == null) {
        const extension = path.extname(child);
        name = path.basename(child, extension);
      }

      let selector;
      try {
        await ready;
        if (scope) { selector = new ScopeSelector(scope).toCssSelector(); }
      } catch (e) {
        e.message = `In file ${e.fileName} at ${JSON.stringify(scope)}: ${e.message}`;
        throw e;
      }
      selector ??= '*';

      snippetsBySelector[selector] ??= {};
      snippetsBySelector[selector][name] = {prefix: tabTrigger, body: content};
    }

    const destination = path.join(this.destinationPath, 'snippets');
    this.writeFileSync(path.join(destination, `${packageName}.cson`), snippetsBySelector);
    return this.normalizeFilenames(destination);
  }

  async convertPreferences(packageName, source) {
    let sourcePreferences = path.join(source, 'preferences');
    if (!fs.isDirectorySync(sourcePreferences)) {
      sourcePreferences = path.join(source, 'Preferences');
    }
    if (!fs.isDirectorySync(sourcePreferences)) { return; }

    const preferencesBySelector = {};
    const destination = path.join(this.destinationPath, 'settings');
    for (let child of Array.from(fs.readdirSync(sourcePreferences))) {
      const {scope, settings} = this.readFileSync(path.join(sourcePreferences, child)) ?? {};
      if (!scope || !settings) { continue; }

      const properties = this.convertSettings(settings);
      if (!properties) {
        continue;
      }
      let selector;
      try {
        await ready;
        selector = new ScopeSelector(scope).toCssSelector();
      } catch (e) {
        e.message = `In file ${e.fileName} at ${JSON.stringify(scope)}: ${e.message}`;
        throw e;
      }
      for (let key in properties) {
        const value = properties[key];
        preferencesBySelector[selector] ??= {};
        preferencesBySelector[selector][key] = preferencesBySelector[selector][key] != null 
          ? { ...value, ...preferencesBySelector[selector][key] }
          : value;
      }
    }

    this.writeFileSync(path.join(destination, `${packageName}.cson`), preferencesBySelector);
    return this.normalizeFilenames(destination);
  }

  convertGrammars(source) {
    let sourceSyntaxes = path.join(source, 'syntaxes');
    if (!fs.isDirectorySync(sourceSyntaxes)) {
      sourceSyntaxes = path.join(source, 'Syntaxes');
    }
    if (!fs.isDirectorySync(sourceSyntaxes)) { return; }

    const destination = path.join(this.destinationPath, 'grammars');
    for (let child of Array.from(fs.readdirSync(sourceSyntaxes))) {
      const childPath = path.join(sourceSyntaxes, child);
      if (fs.isFileSync(childPath)) { this.convertFile(childPath, destination); }
    }

    return this.normalizeFilenames(destination);
  }
};
