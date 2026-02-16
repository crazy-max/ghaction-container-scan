module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts'],
  setupFiles: ['dotenv/config'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          allowJs: true
        }
      }
    ]
  },
  transformIgnorePatterns: ['/node_modules/(?!@actions/)'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/node_modules/@actions/core/lib/core.js',
    '^@actions/exec$': '<rootDir>/node_modules/@actions/exec/lib/exec.js',
    '^@actions/http-client$': '<rootDir>/node_modules/@actions/http-client/lib/index.js',
    '^@actions/http-client/lib/auth$': '<rootDir>/node_modules/@actions/http-client/lib/auth.js',
    '^@actions/http-client/lib/interfaces$': '<rootDir>/node_modules/@actions/http-client/lib/interfaces.js',
    '^@actions/http-client/lib/proxy$': '<rootDir>/node_modules/@actions/http-client/lib/proxy.js',
    '^@actions/tool-cache$': '<rootDir>/node_modules/@actions/tool-cache/lib/tool-cache.js',
    '^@actions/io$': '<rootDir>/node_modules/@actions/io/lib/io.js',
    '^@actions/io/lib/io-util$': '<rootDir>/node_modules/@actions/io/lib/io-util.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: ['src/**/{!(main.ts),}.ts'],
  coveragePathIgnorePatterns: ['dist/', 'node_modules/', '__tests__/'],
  verbose: true
};
