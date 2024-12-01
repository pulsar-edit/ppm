
const path = require('path');
const url = require('url');
const fs = require('./fs');
const request = require('./request');
const TextMateTheme = require('./text-mate-theme');

// Convert a TextMate theme to an Atom theme
module.exports =
class ThemeConverter {
  constructor(sourcePath, destinationPath) {
    this.sourcePath = sourcePath;
    this.destinationPath = path.resolve(destinationPath);
  }

  async readTheme() {
    const {protocol} = url.parse(this.sourcePath);
    if ((protocol === 'http:') || (protocol === 'https:')) {
      const requestOptions = {url: this.sourcePath};
      return new Promise((resolve, reject) => {
        request.get(requestOptions, (error, response, body) => {
          if (error != null) {
            if (error?.code === 'ENOTFOUND') {
              error = `Could not resolve URL: ${this.sourcePath}`;
            }
            return void reject(error);
          }
          if (response.statusCode !== 200) {
            return void reject(`Request to ${this.sourcePath} failed (${response.headers.status})`);
          }
          
          resolve(body);
        });
      });
    }

    const sourcePath = path.resolve(this.sourcePath);
    if (!fs.isFileSync(sourcePath)) {
      throw `TextMate theme file not found: ${sourcePath}`;
    }

    return fs.readFileSync(sourcePath, 'utf8');
  }

  async convert() {
      const themeContents = await this.readTheme();
      const theme = await TextMateTheme.createInstance(themeContents);
      fs.writeFileSync(path.join(this.destinationPath, 'styles', 'base.less'), theme.getStylesheet());
      fs.writeFileSync(path.join(this.destinationPath, 'styles', 'syntax-variables.less'), theme.getSyntaxVariables());
  }
};
