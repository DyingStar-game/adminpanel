import { createInProcessBff } from '@dyingstar-admin/bff/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { server } from './server';

/** Serves the real BFF (in-process, over the persistence mock) to the component under test. */
export function useInProcessBff(dataset?: Item[]) {
  const bff = createInProcessBff(dataset ? { dataset } : {});
  server.use(...bff.handlers);
  return bff;
}
