//@ts-check
const path = require('path');
const { build, mergeConfig } = require('vite');
const { cac } = require('cac');
const rimraf = require('rimraf');
const chalk = require('chalk');

const cli = cac('vite');

const outDir = 'dist';
/** @type {import('vite').InlineConfig} */
const commonConfig = {
  clearScreen: false,
  build: {
    outDir: outDir,
    emptyOutDir: false,
    minify: false,
  },
};

/**
 * removing global flags before passing as command specific sub-configs
 */
function cleanOptions(options) {
  const ret = { ...options };
  delete ret['--'];
  delete ret.coreOnly;
  delete ret.emptyOutDir;
  delete ret.w;
  return ret;
}

cli
  .command('[root]', 'build')
  .option('--coreOnly', `[boolean] build only the core module`)
  .option(
    '--emptyOutDir',
    `[boolean] force empty outDir when it's outside of root`,
  )
  .option(
    '--sourcemap',
    `[boolean] output source maps for build (default: false)`,
  )
  .option('-w, --watch', `[boolean] rebuilds when modules have changed on disk`)
  .action(async (root, options) => {
    const { coreOnly } = options;
    const emptyOutDir = options.emptyOutDir ?? !coreOnly;
    const buildOptions = cleanOptions(options);
    emptyOutDir &&
      rimraf.sync(path.join(root ? path.resolve(root, outDir) : outDir, '/*'));

    console.log(chalk.bgBlue('building core...'));
    await build(
      mergeConfig(commonConfig, {
        root,
        build: {
          target: 'node16',
          ...buildOptions,
          // to achieve @rollup-node-resolve plugin effect
          ssr: true,
          formats: ['es'],
          rollupOptions: {
            input: 'lib/index.ts',
            output: {
              exports: 'default',
            },
            external: [
              // vite will auto collect externals from rollupOptions.input, but vite will delete the 'vite' text from
              // collected externals. so we should manual declare this external.
              'vite',
            ],
          },
        },
        plugins: [],
      }),
    );
    if (!coreOnly) {
      console.log(chalk.bgBlue('building viteClientMock...'));
      await build(
        mergeConfig(commonConfig, {
          root,
          build: {
            target: 'es2015',
            ...buildOptions,
            lib: {
              entry: 'lib/public/viteClientMock/index.ts',
              formats: ['es'],
              fileName: () => 'viteClientMock.js',
            },
            rollupOptions: {
              external: ['@vite/env'],
            },
          },
        }),
      );
    }
  });

cli.parse();
