#!/usr/bin/env node
import { hasGg, readStdinJson, workspaceRoot, writeJson } from "./gg-paths.mjs";
try {
  const root = workspaceRoot(await readStdinJson());
  writeJson({
    additional_context: hasGg(root)
      ? "승인: 이번 턴 고고 있음 → 쓰기 허용"
      : "승인: 쓰려면 사용자가 채팅에 고고라고만 하면 됨. 파일 만들기 안내 금지.",
  });
} catch (err) {
  writeJson({ additional_context: "reminder error: " + String(err) });
}
