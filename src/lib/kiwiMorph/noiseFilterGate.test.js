import { describe, expect, it, afterEach } from 'vitest';
import {
  beginUnifyKiwiNoiseMorphScan,
  endUnifyKiwiNoiseMorphScan,
  getUnifyKiwiNoiseFilterStatus,
  isUnifyKiwiNoiseMorphActive,
  isUnifyKiwiNoisePhase2Available,
  setUnifyFindSkipMorph,
} from './noiseFilterGate.js';

describe('noiseFilterGate', () => {
  afterEach(() => {
    endUnifyKiwiNoiseMorphScan();
    setUnifyFindSkipMorph(false);
  });

  it('1차 핫패스 morph는 항상 비활성', () => {
    expect(isUnifyKiwiNoiseMorphActive()).toBe(false);
    expect(beginUnifyKiwiNoiseMorphScan()).toBe(false);
    expect(beginUnifyKiwiNoiseMorphScan({ forceInactive: true })).toBe(false);
  });

  it('status에 phase2Available 필드를 준다', () => {
    const st = getUnifyKiwiNoiseFilterStatus();
    expect(typeof st.enabled).toBe('boolean');
    expect(typeof st.ready).toBe('boolean');
    expect(typeof st.phase2Available).toBe('boolean');
    expect(st.phase2Available).toBe(isUnifyKiwiNoisePhase2Available());
  });
});
