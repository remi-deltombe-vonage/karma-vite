import type { DiFactory } from '../types/diFactory';
import type { Config } from '../types/karma';
import type { ViteProvider } from './viteServerFactory';

const frameworkFactory: DiFactory<
  [vite: ViteProvider, config: Config],
  ViteProvider
> = (vite, config) => {
  if (config.vite?.autoInit !== false) {
    config.set({
      beforeMiddleware: (config.beforeMiddleware || []).concat([
        'vite3-before',
      ]),
      middleware: (config.middleware || []).concat(['vite3']),
    });
  }
  return vite;
};

frameworkFactory.$inject = ['vite3', 'config'];

export default frameworkFactory;
