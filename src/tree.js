
const _ = require('underscore-plus');

module.exports = function(items, options, callback) {
  if (options == null) { options = {}; }
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }
  if (callback == null) { callback = item => item; }

  if (items.length === 0) {
    const emptyMessage = options.emptyMessage != null ? options.emptyMessage : '(empty)';
    console.log(`\u2514\u2500\u2500 ${emptyMessage}`);
  } else {
    return (() => {
      const result = [];
      for (let index = 0; index < items.length; index++) {
        var itemLine;
        const item = items[index];
        if (index === (items.length - 1)) {
          itemLine = '\u2514\u2500\u2500 ';
        } else {
          itemLine = '\u251C\u2500\u2500 ';
        }
        result.push(console.log(`${itemLine}${callback(item)}`));
      }
      return result;
    })();
  }
};
