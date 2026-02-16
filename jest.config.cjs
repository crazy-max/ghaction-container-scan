module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts'],
  setupFiles: ['dotenv/config'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  },
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/node_modules/@actions/core/lib/core.js',
    '^@actions/exec$': '<rootDir>/node_modules/@actions/core/node_modules/@actions/exec/lib/exec.js',
    '^@actions/http-client$': '<rootDir>/node_modules/@actions/core/node_modules/@actions/http-client/lib/index.js',
    '^@actions/http-client/lib/auth$': '<rootDir>/node_modules/@actions/core/node_modules/@actions/http-client/lib/auth.js',
    '^@actions/http-client/lib/interfaces$': '<rootDir>/node_modules/@actions/core/node_modules/@actions/http-client/lib/interfaces.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: ['src/**/{!(main.ts),}.ts'],
  coveragePathIgnorePatterns: ['dist/', 'node_modules/', '__tests__/'],
  verbose: true
};
