declare const __APP_REVISION__: string | undefined;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Extend Vite's ambient interface through declaration merging.
interface ImportMetaEnv {
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_KEY?: string;
}

// Plain TypeScript tools need a component type for SFC imports; vue-tsc checks their implementation.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}
