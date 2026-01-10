/**
 * ESLint 配置文件
 */

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended' // 继承 Prettier 集成预设（解决冲突+集成格式化）
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 代码质量规则（由 ESLint 管理）
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'arrow-spacing': 'error'
    // 注意：格式化规则（quotes, semi, indent, comma-dangle, max-len, no-trailing-spaces, eol-last）
    // 已由 Prettier 通过 plugin:prettier/recommended 自动管理，无需在此配置
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
