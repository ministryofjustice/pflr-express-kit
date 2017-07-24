module.exports = () => ({
  files: [
    { pattern: 'lib/**/*.js', load: false },
    "!lib/**/*.unit.spec.js",
    { pattern: 'app/**/*.js', load: false },
    "!app/**/*.unit.spec.js",
    { pattern: 'bin/**/*.js', load: false },
    { pattern: 'data/**/*.json', load: false },
    { pattern: 'src/views/**/*', load: false },
    { pattern: 'dist/**/*', load: false }
  ],
  tests: [
    'lib/**/*.unit.spec.js',
    'app/**/*.unit.spec.js'
  ],
  env: {
    type: 'node'
  },
  testFramework: 'tape',
  workers: {
    recycle: true,
    initial: 1,
    regular: 1
  }
})
