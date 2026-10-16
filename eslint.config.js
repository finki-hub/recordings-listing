import {
  base,
  browser,
  node,
  perfectionist,
  prettier,
  typescript,
  vue,
} from 'eslint-config-imperium';

const codeFiles = ['**/*.{js,ts,vue}'];
const config = [
  { ignores: ['.vitepress/cache/**', '.vitepress/dist/**', '.playwright/**'] },
  ...base.map((entry, index) =>
    index === 0 ? { ...entry, files: codeFiles } : entry,
  ),
  {
    ...browser,
    files: [
      '.vitepress/theme/**/*.{ts,vue}',
      '.vitepress/i18n.ts',
      'tests/**/*.ts',
    ],
  },
  {
    ...node,
    files: [
      '*.{js,ts}',
      '**/*.paths.ts',
      '.vitepress/{config,localized-content,site-audit}.ts',
      'tests/**/*.ts',
    ],
  },
  {
    ...typescript,
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ...typescript.languageOptions,
      parserOptions: { extraFileExtensions: ['.vue'], projectService: true },
    },
  },
  vue,
  prettier,
  perfectionist,
  {
    files: [
      '.vitepress/theme/{analytics,search-analytics}.ts',
      'tests/**/*.ts',
    ],
    // PostHog's public configuration and wire format use snake_case fields.
    rules: { camelcase: ['error', { properties: 'never' }] },
  },
  {
    files: ['.vitepress/config.ts', 'playwright.config.ts'],
    // Configuration entrypoints intentionally initialize build plugins and test devices.
    rules: { 'unicorn/no-top-level-side-effects': 'off' },
  },
  {
    files: ['.vitepress/theme/analytics.ts'],
    languageOptions: { globals: { __APP_REVISION__: 'readonly' } },
  },
  {
    files: ['.vitepress/localized-content.ts', 'tests/**/*.ts'],
    // These loaders and fixtures read repository files and installed SDK assets.
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
  {
    files: ['tests/analytics.test.ts', 'tests/fixtures/analytics.ts'],
    // Browser interface mocks include no-op instance methods and Node Buffer transport codecs.
    rules: {
      'class-methods-use-this': 'off',
      'unicorn/prefer-uint8array-base64': 'off',
    },
  },
  {
    files: ['tests/fixtures/analytics.ts'],
    // Execute the installed SDK only inside the isolated VM, with all browser transports stubbed.
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      'sonarjs/code-eval': 'off',
    },
  },
];

export default config;
