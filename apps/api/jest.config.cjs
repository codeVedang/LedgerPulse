module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@ledgerpulse/domain$': '<rootDir>/../../packages/domain/src',
    '^@ledgerpulse/contracts$': '<rootDir>/../../packages/contracts/src',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
