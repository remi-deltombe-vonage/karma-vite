const vite = require('vite');
const path = require('path');

module.exports = vite.defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/index.ts'),
      name: 'karma-vite',
      fileName: 'index',
      emptyOutDir: true,
    },
  },
  plugins: [],
});
