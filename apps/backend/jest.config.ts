import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.spec.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@screen-time/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^@screen-time/core$': '<rootDir>/../../packages/core/src/index.ts',
  },
};

export default config;
