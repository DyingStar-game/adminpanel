/**
 * Server-scoped persistence item operations (delegates to persistence client).
 */
import type { CreateItemRequest, PutItemRequest } from '@dyingstar/shared';
import { persistenceClient } from '../clients/persistence.client.js';
import type { ServerConfig } from '../domain/server.types.js';

/** CRUD facade for items on a specific game server's persistence URL. */
export const itemsService = {
  /**
   * Lists items for the given server with pagination and filters.
   * @param server - Active server configuration.
   * @param params - Query parameters forwarded to persistence.
   * @returns Paginated list response from persistence.
   */
  list(
    server: ServerConfig,
    params: {
      page: number;
      page_size: number;
      object_type?: string;
      scenename?: string;
      parent_id?: string;
    },
  ) {
    return persistenceClient.list(server.services.persistence, params);
  },

  /**
   * Gets one item by UUID.
   * @param server - Active server configuration.
   * @param uuid - Item object UUID.
   * @returns Item or null if not found.
   */
  get(server: ServerConfig, uuid: string) {
    return persistenceClient.get(server.services.persistence, uuid);
  },

  /**
   * Creates an item on the server's persistence service.
   * @param server - Active server configuration.
   * @param body - Create item request.
   * @returns Created item.
   */
  create(server: ServerConfig, body: CreateItemRequest) {
    return persistenceClient.create(server.services.persistence, body);
  },

  /**
   * Updates an item by UUID.
   * @param server - Active server configuration.
   * @param uuid - Item object UUID.
   * @param body - Update payload.
   * @returns Updated item or null if not found.
   */
  update(server: ServerConfig, uuid: string, body: PutItemRequest) {
    return persistenceClient.update(server.services.persistence, uuid, body);
  },

  /**
   * Deletes an item by UUID.
   * @param server - Active server configuration.
   * @param uuid - Item object UUID.
   * @returns True if deleted.
   */
  delete(server: ServerConfig, uuid: string) {
    return persistenceClient.delete(server.services.persistence, uuid);
  },
};
