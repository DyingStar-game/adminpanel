/**
 * API router: public routes plus protected routes requiring server context.
 */
import { Router, type IRouter } from 'express';
import { authMiddlewareStub, serverContextMiddleware } from '../middleware/serverContext.js';
import { publicRoutes } from './public.routes.js';
import { itemsRoutes } from './items.routes.js';
import { missionsRoutes } from './missions.routes.js';
import { adminRoutes } from './admin.routes.js';
import { bansRoutes } from './bans.routes.js';
import { serverRoutes } from './server.routes.js';

/** Top-level `/api` router mounting public and protected sub-routers. */
export const apiRouter: IRouter = Router();

apiRouter.use(publicRoutes);

const protectedRouter = Router();
protectedRouter.use(authMiddlewareStub);
protectedRouter.use(serverContextMiddleware);

protectedRouter.use('/items', itemsRoutes);
protectedRouter.use('/missions', missionsRoutes);
protectedRouter.use('/admin', adminRoutes);
protectedRouter.use('/bans', bansRoutes);
protectedRouter.use('/', serverRoutes);

apiRouter.use(protectedRouter);
