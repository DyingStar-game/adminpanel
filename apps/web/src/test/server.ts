import { setupServer } from 'msw/node';

/** MSW server shared by frontend tests; each test registers the handlers it needs. */
export const server = setupServer();
