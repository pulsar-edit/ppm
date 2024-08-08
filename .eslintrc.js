module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
    node: true
  },
  extends: [
    "eslint:recommended",
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
    "no-empty": "off",
    "no-unused-vars": [ "error", {
      argsIgnorePattern: "^_"
    }]
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
    "waitsFor": "readonly",
    "jasmine": "readonly"
  }
};
