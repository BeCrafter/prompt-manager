/**
 * ESLint 配置文件
 */

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 启用的规则
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'arrow-spacing': 'error',
    'comma-dangle': ['error', 'never'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    indent: ['error', 2],
    'max-len': ['warn', { code: 120 }],
    'no-trailing-spaces': 'error',
    'eol-last': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
      env: {
        node: true,
        es2021: true
      },
      rules: {
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['scripts/**/*.js', 'tools/**/*.js'],
      rules: {
        'no-console': 'off'
      }
    }
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', 'test-results/', 'playwright-report/', 'html/']
};
