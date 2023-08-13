module.exports = {
  rootDir: '.',
  modulePaths: ['<rootDir>'],
  testEnvironment: 'node',
  preset: 'ts-jest',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'ts', 'json'],
  coveragePathIgnorePatterns: ['coverage', 'dist'],
};
