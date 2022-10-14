import beforeMiddlewareFactory from './factory/beforeMiddlewareFactory';
import frameworkFactory from './factory/frameworkFactory';
import middlewareFactory from './factory/middlewareFactory';
import viteServerFactory from './factory/viteServerFactory';
import type { KarmaViteConfig } from './type';

export default {
  'framework:vite3': ['factory', frameworkFactory],
  'middleware:vite3': ['factory', middlewareFactory],
  'middleware:vite3-before': ['factory', beforeMiddlewareFactory],
  vite3: ['factory', viteServerFactory],
} as const;

declare module 'karma' {
  export interface ConfigOptions {
    vite?: KarmaViteConfig;
  }
}
