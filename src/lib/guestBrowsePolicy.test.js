import { describe, expect, it, beforeEach } from 'vitest';
import {
  GUEST_BROWSE_CAPABILITIES,
  beginGuestBrowse,
  endGuestBrowse,
  guestBrowseAllowsCheckAndResults,
  guestBrowseAllowsDemoPdfAutoLoad,
  guestBrowseAllowsWorkspaceStay,
} from './guestBrowsePolicy.js';

describe('guestBrowsePolicy', () => {
  beforeEach(() => {
    endGuestBrowse();
  });

  it('비활성 시 모든 허용이 false', () => {
    expect(guestBrowseAllowsWorkspaceStay()).toBe(false);
    expect(guestBrowseAllowsDemoPdfAutoLoad()).toBe(false);
    expect(guestBrowseAllowsCheckAndResults()).toBe(false);
  });

  it('활성 시 정책 플래그에 따라 허용', () => {
    beginGuestBrowse();
    expect(guestBrowseAllowsWorkspaceStay()).toBe(
      GUEST_BROWSE_CAPABILITIES.stayOnMainWithoutLogin,
    );
    expect(guestBrowseAllowsDemoPdfAutoLoad()).toBe(
      GUEST_BROWSE_CAPABILITIES.demoPdfAutoLoad,
    );
    expect(guestBrowseAllowsCheckAndResults()).toBe(
      GUEST_BROWSE_CAPABILITIES.runCheckAndResultPopup,
    );
  });
});
