const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseAdminAllowlist, isQuotaAdmin } = require('./adminAllowlist.js');

describe('parseAdminAllowlist', () => {
  it('쉼표 목록을 자른다', () => {
    assert.deepEqual(parseAdminAllowlist(' a ,b, '), ['a', 'b']);
  });

  it('lowercase 옵션', () => {
    assert.deepEqual(
      parseAdminAllowlist('A@B.C', { lowercase: true }),
      ['a@b.c'],
    );
  });
});

describe('isQuotaAdmin', () => {
  it('uid 또는 email 매칭', () => {
    assert.equal(
      isQuotaAdmin(
        { uid: 'admin-1', token: { email: 'x@y.z' } },
        { uids: 'admin-1', emails: '' },
      ),
      true,
    );
    assert.equal(
      isQuotaAdmin(
        { uid: 'other', token: { email: 'Admin@Test.io' } },
        { uids: '', emails: 'admin@test.io' },
      ),
      true,
    );
    assert.equal(
      isQuotaAdmin(
        { uid: 'other', token: { email: 'no@test.io' } },
        { uids: 'admin-1', emails: 'admin@test.io' },
      ),
      false,
    );
  });
});
