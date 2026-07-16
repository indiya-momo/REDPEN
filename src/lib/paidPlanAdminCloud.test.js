import { describe, expect, it } from 'vitest';
import { formatPaidPlanAdminError } from './paidPlanAdminCloud.js';

describe('formatPaidPlanAdminError', () => {
  it('functions 코드 prefix를 정규화한다', () => {
    expect(
      formatPaidPlanAdminError({
        code: 'functions/permission-denied',
        message: 'x',
      }),
    ).toBe('관리자만 사용할 수 있습니다.');
  });

  it('not-found 기본 안내', () => {
    expect(
      formatPaidPlanAdminError({ code: 'not-found', message: '' }),
    ).toContain('가입');
  });
});
