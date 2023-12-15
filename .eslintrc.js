module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true
  },
  extends: [
    "eslint:recommended",
    "plugin:node/recommended"
  ],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest"
  },
  rules: {
    "space-before-function-paren": [ "error", {
      anonymous: "always",
      asyncArrow: "always",
      named: "never"
    }],
    "prettier/prettier": "off",
    "ember-suave/lines-between-object-propertiess": "off",
    "no-empty": "off"
  },
  plugins: [],
  globals: {
    "describe": "readonly",
    "it": "readonly",
    "runs": "readonly",
    "expect": "readonly",
    "beforeEach": "readonly",
    "afterEach": "readonly",
    "silenceOutput": "readonly",
    "spyOn": "readonly",
    "spyOnToken": "readonly",
    "waitsFor": "readonly"
  }
};
