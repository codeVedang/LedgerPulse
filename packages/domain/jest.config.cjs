module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
};
