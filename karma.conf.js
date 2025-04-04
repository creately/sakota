module.exports = function(config) {
  config.set({
    browsers: ['ChromeHeadless'],
    frameworks: ['jasmine'],
    files: [
      { pattern: 'src/__tests.ts' },
    ],
    mime: {
      'text/x-typescript': ['ts'],
    },
    plugins: [
      'karma-webpack',
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-coverage',
    ],
    preprocessors: {
      'src/**/*.ts': ['webpack', 'coverage'], // Added 'coverage'
    },
    webpack: {
      mode: 'development',
      resolve: {
        extensions: ['.ts', '.js'],
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            loader: 'ts-loader',
          },
        ],
      },
    },
    reporters: ['dots', 'coverage'],
    coverageReporter: {
      dir: 'coverage/',
      reports: ['text-summary', 'html', 'lcovonly'],
      check: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  });
};
