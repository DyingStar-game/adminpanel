import { createInProcessBff, TEST_SERVER_ID } from '@dyingstar-admin/bff/testing';
import type { Item } from '@dyingstar-admin/schemas';
import { usePreferences } from '@/stores/preferences';
import { server } from './server';

/** Serves the real BFF (in-process, over the persistence mock) to the component under test. */
export function useInProcessBff(dataset?: Item[]) {
  const bff = createInProcessBff(dataset ? { dataset } : {});
  server.use(...bff.handlers);
  usePreferences.setState({ serverId: TEST_SERVER_ID });
  return bff;
}
