const schedule = jest.fn();

const restart = jest.fn();
const close = jest.fn();
const wsSend = jest.fn();
const createServer = jest.fn(() =>
  Promise.resolve({
    restart,
    close: close,
    config: {
      inlineConfig: {},
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    },
    ws: {
      send: wsSend,
    },
  }),
) as jest.Mock;
const vitePluginIstanbul = jest.fn().mockReturnValue({
  name: 'vite:istanbul',
});

jest.mock('vite', () => {
  const vite = jest.requireActual('vite');
  return {
    ...vite,
    createServer,
  };
});
jest.mock('vite-plugin-istanbul', () => {
  return {
    __esModule: true,
    default: vitePluginIstanbul,
  };
});

import path from 'path';
import viteServerFactory from '@/factory/viteServerFactory';
import { Injector } from 'di';
import type { ViteDevServerInternal } from '@/factory/viteServerFactory';
import type { DiFactory } from '@/types/diFactory';
import type { ConfigOptions } from 'karma';
import { COVERAGE_DIR } from '@/constants';

function createViteDevServer(config?: ConfigOptions) {
  const mergedConfig = {
    basePath: './',
    urlRoot: '/',
    reporters: [],
    ...config,
  };

  const executor: DiFactory = () => ({
    schedule,
  });
  executor.$inject = [];
  const injector = new Injector([
    {
      config: ['value', mergedConfig],
      vite: ['factory', viteServerFactory],
      executor: ['factory', executor],
    },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (injector.invoke as any)(viteServerFactory as any);
}

afterEach(() => {
  restart.mockClear();
  wsSend.mockClear();
  createServer.mockClear();
  vitePluginIstanbul.mockClear();
  schedule.mockClear();
});

describe('viteServerFactory', () => {
  it('return value should be promise with value property', async () => {
    const vitePromise = createViteDevServer();
    expect(typeof vitePromise.then).toBe('function');
    expect(vitePromise.value).toBe(undefined);
    const vite = await vitePromise;
    expect(vitePromise.value).toBe(vite);
  });

  describe('createServer config', () => {
    it('merge user config', async () => {
      const userConfig = {
        base: 'a/b/c/',
        configFile: false,
      } as const;
      await createViteDevServer({
        vite: {
          config: userConfig,
        },
      });
      expect(createServer.mock.calls[0][0]).toEqual(
        expect.objectContaining(userConfig),
      );
    });

    it('merge user promise config', async () => {
      const userConfig = {
        base: 'a/b/c/',
        configFile: false,
      } as const;
      await createViteDevServer({
        vite: {
          config: () => Promise.resolve(userConfig),
        },
      });

      expect(createServer.mock.calls[0][0]).toEqual(
        expect.objectContaining(userConfig),
      );
    });

    it('find optimize deps entries in karma files', async () => {
      await createViteDevServer({
        files: [
          'file1.ts',
          { pattern: 'files2.ts', type: 'module', served: false },
          { pattern: 'files3.ts', type: 'module', served: true },
          { pattern: 'files4.ts', served: true },
        ],
      });
      const viteConfig = createServer.mock.calls[0][0];
      const entries = viteConfig.optimizeDeps.entries;
      expect(entries).toEqual(['files2.ts']);
    });

    it('istanbulPlugin should be used if enable coverage', async () => {
      await createViteDevServer({
        vite: {
          coverage: {
            enable: true,
          },
        },
      });
      const viteConfig = createServer.mock.calls[0][0];
      expect(vitePluginIstanbul).toBeCalled();
      expect(viteConfig.plugins).toEqual(
        expect.objectContaining([{ name: 'vite:istanbul' }]),
      );
    });

    it('istanbulPlugin should be used if the config of reporters contain the "coverage" text', async () => {
      await createViteDevServer({
        reporters: ['coverage'],
      });
      const viteConfig = createServer.mock.calls[0][0];
      expect(vitePluginIstanbul).toBeCalled();
      expect(viteConfig.plugins).toEqual(
        expect.objectContaining([{ name: 'vite:istanbul' }]),
      );
    });

    it('istanbulPlugin should not be used if coverage config is set ot false even reporters contain the "coverage" text', async () => {
      await createViteDevServer({
        reporters: ['coverage'],
        vite: {
          coverage: {
            enable: false,
          },
        },
      });
      expect(vitePluginIstanbul).not.toBeCalled();
    });

    it('istanbulPlugin cwd config should be config.basePath if config.vite.coverage.cwd is not exist', async () => {
      const istanbulOriginConfig = {
        include: ['a'],
        exclude: ['b'],
        extension: 'js',
      };
      await createViteDevServer({
        basePath: '/a/b/c/',
        vite: {
          coverage: {
            enable: true,
            ...istanbulOriginConfig,
          },
        },
      });
      const vitePluginIstanbulConfig = vitePluginIstanbul.mock.calls[0][0];
      expect(vitePluginIstanbulConfig).toEqual({
        ...istanbulOriginConfig,
        cwd: '/a/b/c/',
      });
    });

    it('vite server watch config should ignore coverage reporters dir', async () => {
      const coverageDir = 'temp_coverage';
      await createViteDevServer({
        vite: {
          coverage: {
            dir: coverageDir,
          },
        },
      });
      const viteConfig = createServer.mock.calls[0][0];
      expect(viteConfig.server.watch.ignored).toEqual(
        expect.arrayContaining([path.resolve(coverageDir, '**')]),
      );
    });

    it('coverage reporters dir should be config.coverageReporter.dir or config.coverageIstanbulReporter.dir', async () => {
      const coverageDir = 'temp_coverage';
      await createViteDevServer({
        coverageReporter: {
          dir: coverageDir,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      let lastViteConfig = createServer.mock.calls[0][0];
      expect(lastViteConfig.server.watch.ignored).toEqual(
        expect.arrayContaining([path.resolve(coverageDir, '**')]),
      );

      await createViteDevServer({
        coverageIstanbulReporter: {
          dir: coverageDir,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      lastViteConfig = createServer.mock.calls[1][0];
      expect(lastViteConfig.server.watch.ignored).toEqual(
        expect.arrayContaining([path.resolve(coverageDir, '**')]),
      );

      await createViteDevServer();
      lastViteConfig = createServer.mock.calls[2][0];
      expect(lastViteConfig.server.watch.ignored).toEqual(
        expect.arrayContaining([path.resolve(COVERAGE_DIR, '**')]),
      );
    });
  });

  describe('rewrite vite server restart method', () => {
    let vite: ViteDevServerInternal;
    beforeEach(async () => {
      vite = await createViteDevServer();
    });
    it('restart method should return new vite server after it was rewritten', async () => {
      const newVite = await vite.restart();
      expect(newVite).not.toStrictEqual(vite);
      expect(newVite?.ws).not.toEqual(undefined);
    });

    it('should copy the property of new vite server to old vite server', async () => {
      const oldViteConfig = vite.config;
      const newVite = await vite.restart();
      expect(oldViteConfig).not.toStrictEqual(vite.config);
      expect(vite.config).toStrictEqual(newVite?.config);
    });

    it('the createServer method should not be called again if the previous restart method did not complete', async () => {
      createServer.mockClear();
      void vite.restart();
      await vite.restart();
      expect(createServer).toBeCalledTimes(1);
    });
  });

  describe('vite server intercept', () => {
    let vite: ViteDevServerInternal;
    beforeEach(async () => {
      vite = await createViteDevServer();
    });

    it('after the ws.send method is called with "update" type payload, the executor.schedule method should be called', () => {
      expect(schedule).not.toBeCalled();
      vite.ws.send({ type: 'full-reload' });
      expect(schedule).toBeCalled();
    });

    it('after the vite server restarted, the executor.schedule method should be called', async () => {
      await vite.restart();
      expect(schedule).toBeCalled();
    });

    it('after the vite server restart, the newServer should be intercepte again', async () => {
      let newServer = await vite.restart();
      expect(schedule).toBeCalledTimes(1);
      newServer?.ws.send({ type: 'full-reload' });
      expect(schedule).toBeCalledTimes(2);

      newServer = await newServer?.restart();
      expect(schedule).toBeCalledTimes(3);
      newServer?.ws.send({ type: 'full-reload' });
      expect(schedule).toBeCalledTimes(4);
    });
  });
});
