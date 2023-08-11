module.exports = {
  rootDir: '.',
  modulePaths: ['<rootDir>'],
  testEnvironment: 'node',
  preset: 'ts-jest',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'ts'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coveragePathIgnorePatterns: ['coverage'],
};
