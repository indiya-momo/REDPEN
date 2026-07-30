import { describe, expect, it } from 'vitest';
import { attachJosaReviewHints } from './unifyJosaReview.js';
import golden from './unifyJosaReviewSlm.golden.json';
import {
  filterJosaReviewBySlm,
  normalizeSlmReviewResult,
  shouldPromoteJosaReview,
} from './unifyJosaReviewSlm/index.js';
import { createGoldenRunner } from './unifyJosaReviewSlm/runner/goldenRunner.js';

describe('unifyJosaReviewSlm golden — parseCases', () => {
  it.each(golden.parseCases)('$id', ({ raw, expectNormalized, expectPromote }) => {
    const normalized = normalizeSlmReviewResult(raw);
    if (expectNormalized) {
      expect(normalized).not.toBeNull();
      expect(shouldPromoteJosaReview(normalized)).toBe(expectPromote);
    } else {
      expect(normalized).toBeNull();
    }
  });
});

describe('unifyJosaReviewSlm golden — pipelineCases', () => {
  it.each(golden.pipelineCases)('$id', async (fixture) => {
    const clusterInput = fixture.useAttachHints
      ? attachJosaReviewHints([fixture.cluster])[0]
      : fixture.cluster;

    if (fixture.expectTier) {
      expect(clusterInput.josaReviewCandidate?.tier).toBe(fixture.expectTier);
    }
    if (fixture.expectStemMismatch) {
      expect(clusterInput.josaReviewCandidate?.stemKey).toBeTruthy();
    }

    const responsesById = {};
    if (fixture.slmResponse) {
      responsesById[clusterInput.key] = fixture.slmResponse;
    } else if (fixture.omitSlmResponse) {
      responsesById[clusterInput.key] = null;
    }

    const runner =
      fixture.slmResponse != null || fixture.omitSlmResponse
        ? createGoldenRunner(responsesById)
        : undefined;

    const [out] = await filterJosaReviewBySlm([clusterInput], {
      runner,
      slmModel: runner ? 'golden-fixture' : undefined,
    });

    if (fixture.expectJosaReview) {
      expect(out.josaReview?.status).toBe('review');
    } else {
      expect(out.josaReview).toBeUndefined();
    }

    if (fixture.expectAuxReview) {
      expect(out.auxReview?.status).toBe('review');
    }
  });
});

describe('unifyJosaReviewSlm golden — fixture shape', () => {
  it('parseCases + pipelineCases = 20건', () => {
    expect(golden.parseCases).toHaveLength(10);
    expect(golden.pipelineCases).toHaveLength(10);
  });
});
