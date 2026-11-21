import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: [
      'dist/**/*',
      'dev-dist/**/*',
      'build/**/*',
      'coverage/**/*',
      'node_modules/**/*',
    ],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
