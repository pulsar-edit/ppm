
module.exports = (items, options, callback) => { //TODO clean up signature and usage
  options ??= {};
  if (options instanceof Function) {
    callback = options;
    options = {};
  }
  callback ??= item => item;

  if (items.length === 0) {
    const emptyMessage = options.emptyMessage ?? '(empty)';
    console.log(`\u2514\u2500\u2500 ${emptyMessage}`);
    return;
  }

  items.forEach((item, index) => {
    const itemLine = index === (items.length - 1) ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
    console.log(`${itemLine}${callback(item)}`)
  });
};
