import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./appDialog.js', () => ({
  showAppAlert: vi.fn(async () => {}),
}));

vi.mock('./userProfileCloud.js', () => ({
  ensureLocalPlanFromCloud: vi.fn(async () => 'free'),
}));

import { showAppAlert } from './appDialog.js';
import { ensureLocalPlanFromCloud } from './userProfileCloud.js';
import {
  assertPaidCheckResultsOrAlert,
  assertPaidShareOrAlert,
  isPaidUser,
  resolveUserPlan,
} from './paidPlanGate.js';

describe('paidPlanGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveUserPlan / isPaidUser', async () => {
    vi.mocked(ensureLocalPlanFromCloud).mockResolvedValueOnce('paid');
    await expect(resolveUserPlan('u1')).resolves.toBe('paid');
    vi.mocked(ensureLocalPlanFromCloud).mockResolvedValueOnce('paid');
    await expect(isPaidUser('u1')).resolves.toBe(true);
    vi.mocked(ensureLocalPlanFromCloud).mockResolvedValueOnce('free');
    await expect(isPaidUser('u1')).resolves.toBe(false);
  });

  it('assertPaidShareOrAlert: paid 통과, free 알림', async () => {
    vi.mocked(ensureLocalPlanFromCloud).mockResolvedValueOnce('paid');
    await expect(assertPaidShareOrAlert('u1')).resolves.toBe(true);
    expect(showAppAlert).not.toHaveBeenCalled();

    vi.mocked(ensureLocalPlanFromCloud).mockResolvedValueOnce('free');
    await expect(assertPaidShareOrAlert('u1')).resolves.toBe(false);
    expect(showAppAlert).toHaveBeenCalledTimes(1);
  });

  it('assertPaidCheckResultsOrAlert: free 알림', async () => {
    vi.mocked(ensureLocalPlanFromCloud).mockResolvedValueOnce('free');
    await expect(assertPaidCheckResultsOrAlert('u1')).resolves.toBe(false);
    expect(showAppAlert).toHaveBeenCalledTimes(1);
  });
});
