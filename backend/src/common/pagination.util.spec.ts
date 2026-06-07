import { parsePagination, MAX_LIMIT } from './pagination.util';

describe('parsePagination', () => {
  it('defaults to page 1 and limit 50 when omitted', () => {
    const p = parsePagination(undefined, undefined);
    expect(p.page).toBe(1);
    expect(p.limit).toBe(50);
    expect(p.skip).toBe(0);
  });

  it('caps limit at MAX_LIMIT', () => {
    const p = parsePagination('1', '9999');
    expect(p.limit).toBe(MAX_LIMIT);
  });

  it('computes skip from page number', () => {
    const p = parsePagination('3', '10');
    expect(p.skip).toBe(20);
  });
});
