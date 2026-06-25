import { describe, it, expect, vi } from 'vitest';

vi.mock('better-sqlite3', () => ({ default: vi.fn(() => ({ pragma: vi.fn(), exec: vi.fn(), prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })), close: vi.fn() })) }));
vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-uuid') }));
vi.mock('../importer', () => ({ parseExcelRows: vi.fn(), importTestCases: vi.fn(() => ({ imported: 10, updated: 5, skipped: 0, errors: [] })) }));

import { getZephyrConfig, setZephyrConfig } from '../zephyr-client';

function buildFolderPath(folder: any): string {
  const parts: string[] = [];
  let f = folder;
  while (f) { if (f.name) parts.unshift(f.name); f = f.parent; }
  return parts.join(' / ');
}

describe('buildFolderPath', () => {
  it('single folder', () => expect(buildFolderPath({ name: 'Регресс', parent: null })).toBe('Регресс'));
  it('nested 3 levels', () => expect(buildFolderPath({ name: 'Создание', parent: { name: 'ДОГОВОРЫ', parent: { name: 'Регресс', parent: null } } })).toBe('Регресс / ДОГОВОРЫ / Создание'));
  it('null', () => expect(buildFolderPath(null)).toBe(''));
  it('undefined parent', () => expect(buildFolderPath({ name: 'Test', parent: undefined })).toBe('Test'));
  it('4 levels', () => expect(buildFolderPath({ name: 'L4', parent: { name: 'L3', parent: { name: 'L2', parent: { name: 'L1', parent: null } } } })).toBe('L1 / L2 / L3 / L4'));
  it('empty name', () => expect(buildFolderPath({ name: '', parent: { name: 'P', parent: null } })).toBe('P'));
});

describe('ZephyrConfig', () => {
  it('returns object', () => {
    const config = getZephyrConfig();
    expect(config).toHaveProperty('baseUrl');
    expect(config).toHaveProperty('projectKey');
  });

  it('set updates projectKey', () => {
    const orig = getZephyrConfig().projectKey;
    setZephyrConfig({ projectKey: 'SHTE' });
    expect(getZephyrConfig().projectKey).toBe('SHTE');
    setZephyrConfig({ projectKey: orig });
  });

  it('set updates baseUrl', () => {
    const orig = getZephyrConfig().baseUrl;
    setZephyrConfig({ baseUrl: 'https://custom.jira.com' });
    expect(getZephyrConfig().baseUrl).toBe('https://custom.jira.com');
    setZephyrConfig({ baseUrl: orig });
  });

  it('get returns copy', () => {
    const c1 = getZephyrConfig();
    c1.projectKey = 'MUTATED';
    expect(getZephyrConfig().projectKey).not.toBe('MUTATED');
  });
});
