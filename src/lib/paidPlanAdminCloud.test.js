import { describe, expect, it } from 'vitest';
import {
  formatPaidPlanAdminError,
  formatPaidUpdatedAt,
} from './paidPlanAdminCloud.js';

describe('formatPaidPlanAdminError', () => {
  it('functions 코드 prefix를 정규화한다', () => {
    expect(
      formatPaidPlanAdminError({
        code: 'functions/permission-denied',
        message: 'x',
      }),
    ).toBe('관리자만 사용할 수 있습니다.');
  });

  it('함수 미배포 not-found는 배포 안내', () => {
    expect(
      formatPaidPlanAdminError({ code: 'not-found', message: '' }),
    ).toContain('배포');
  });

  it('가입 not-found는 온보딩 안내', () => {
    expect(
      formatPaidPlanAdminError({
        code: 'not-found',
        message: '해당 이메일로 가입·로그인(온보딩) 후 다시 등록해 주세요.',
      }),
    ).toContain('가입');
  });

  it('TypeError 메시지는 응답 읽기 실패로 바꾼다', () => {
    expect(
      formatPaidPlanAdminError({
        code: 'internal',
        message: "Cannot read properties of undefined (reading 'email')",
      }),
    ).toContain('서버 응답');
  });

  it('목록 unwrap 실패 메시지는 응답 읽기 실패로 안내', () => {
    expect(
      formatPaidPlanAdminError({
        code: 'internal',
        message: '서버 응답을 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
      }),
    ).toContain('서버 응답');
  });
});

describe('formatPaidUpdatedAt', () => {
  it('유효한 시각을 포맷한다', () => {
    expect(formatPaidUpdatedAt(0)).toBe('—');
    expect(formatPaidUpdatedAt(Date.parse('2026-07-16T00:00:00+09:00'))).toMatch(
      /2026/,
    );
  });
});
