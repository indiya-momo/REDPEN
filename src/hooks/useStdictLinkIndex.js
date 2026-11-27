import { useEffect, useState } from 'react';
import {
  ensureStdictLinkIndexLoaded,
  getStdictLinkIndex,
} from '../lib/stdictLinkIndex.js';

/**
 * 표준국어대사전 링크 색인을 한 번만 읽어 돌려줍니다.
 * 아직 안 읽었거나 실패했으면 null이며, 카드는 링크 없이 그대로 보입니다.
 * @returns {Record<string, number[]> | null}
 */
export function useStdictLinkIndex() {
  const [index, setIndex] = useState(getStdictLinkIndex);

  useEffect(() => {
    if (index) return undefined;
    let alive = true;
    ensureStdictLinkIndexLoaded().then((entries) => {
      if (alive && entries) setIndex(entries);
    });
    return () => {
      alive = false;
    };
  }, [index]);

  return index;
}
