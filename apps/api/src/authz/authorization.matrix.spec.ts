import { matrixAllows } from './authorization.matrix';

describe('authorization matrix', () => {
  it('allows any authenticated user for media upload', () => {
    expect(matrixAllows('media.upload', ['USER'])).toBe(true);
  });

  it('denies media.read_any for USER', () => {
    expect(matrixAllows('media.read_any', ['USER'])).toBe(false);
  });

  it('allows media.read_any for ADMIN', () => {
    expect(matrixAllows('media.read_any', ['ADMIN'])).toBe(true);
  });

  it('restricts admin.assign_role to ADMIN', () => {
    expect(matrixAllows('admin.assign_role', ['USER'])).toBe(false);
    expect(matrixAllows('admin.assign_role', ['CLEANUP_PARTNER'])).toBe(false);
    expect(matrixAllows('admin.assign_role', ['ADMIN'])).toBe(true);
  });
});
