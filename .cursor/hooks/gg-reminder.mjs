#!/usr/bin/env node
import { readStdinJson, writeJson } from "./gg-paths.mjs";
try {
  const payload = await readStdinJson();
  const mode = String(payload?.composer_mode ?? "").toLowerCase();
  const isPlan = mode === "plan" || mode.includes("plan");
  writeJson({
    additional_context: isPlan
      ? "승인: 계획 모드 — 쓰려면 사용자가 채팅에 고고라고 해야 함. Agent 진행에서는 고고 불필요."
      : "승인: Agent/실제 진행 — 고고(ㄱㄱ) 쓰기 게이트 없음. 계획 모드에서만 고고 필요.",
  });
} catch (err) {
  writeJson({ additional_context: "reminder error: " + String(err) });
}