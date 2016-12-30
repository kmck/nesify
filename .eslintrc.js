module.exports = {
  extends: 'airbnb-base',
  env: {
    node: true,
  },
  parser: 'babel-eslint',
  rules: {
    'indent': ['error', 2, {
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1,
    }],
    'max-len': ['warn', {
      code: 100,
      comments: 100,
      ignorePattern: '^\\s*(\'.*\'|".*"|`.*`)[,;]?$',
    }],
    'no-underscore-dangle': 'off',
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: false,
    }],
    'space-before-function-paren': ['error', {
      anonymous: 'never',
      named: 'never',
    }],
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: true,
    }],
    'import/extensions': ['error', {
      js: 'never',
      mjs: 'never',
    }],
  },
};
