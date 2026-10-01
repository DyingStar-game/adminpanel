import { describe, expect, it } from 'vitest';
import { parseServers, toPublicServer } from './servers';

const server = {
  id: 'universe-testing',
  name: 'Universe Testing',
  environment: 'testing',
  persistenceUrl: 'http://46.231.240.213:31001',
};

describe('parseServers', () => {
  it('parses a JSON array and defaults the environment', () => {
    const [parsed] = parseServers(JSON.stringify([{ ...server, environment: undefined }]));
    expect(parsed).toEqual({ ...server, environment: 'testing' });
  });

  it('rejects invalid JSON, a bad URL and duplicate ids', () => {
    expect(() => parseServers('not json')).toThrow(/JSON array/);
    expect(() => parseServers(JSON.stringify([{ ...server, persistenceUrl: 'nope' }]))).toThrow(
      /Invalid SERVERS/,
    );
    expect(() => parseServers(JSON.stringify([server, server]))).toThrow(/unique/);
  });

  it('exposes only public fields', () => {
    expect(toPublicServer(server)).toEqual({
      id: 'universe-testing',
      name: 'Universe Testing',
      environment: 'testing',
    });
  });
});
