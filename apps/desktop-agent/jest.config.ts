import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.(spec|test)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.spec.ts'],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@screen-time/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@screen-time/adapters$': '<rootDir>/../../packages/adapters/src/index.ts',
    '^@screen-time/api-contract$': '<rootDir>/../../packages/api-contract/src/index.ts',
  },
};

export default config;
