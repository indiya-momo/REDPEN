#!/usr/bin/env python3
"""
카나나-2 1.3B instruct 수동 정찰 — JSON 분류 5건.
사전: pip install "transformers>=4.57" accelerate torch
GPU 없으면 CPU (느림). 최초 실행 시 ~2.6GB+ 다운로드.
"""
from __future__ import annotations

import json
import re
import sys

MODEL_ID = "kakaocorp/kanana-2-1.3b-instruct"

FIXTURES = [
    {
        "id": "활동 이며",
        "variant": "활동 이며",
        "gluedVariant": "활동이며",
        "ruleStem": "활동",
        "ruleSuffix": "이며",
        "context": "…지속적인 활동 이며 그 결과가…",
        "expect_boundary": True,
    },
    {
        "id": "지속 되었는가",
        "variant": "지속 되었는가",
        "gluedVariant": "지속되었는가",
        "ruleStem": "지속",
        "ruleSuffix": "되었는가",
        "context": "…성장이 지속 되었는가를 보면…",
        "expect_boundary": True,
    },
    {
        "id": "가치평가가",
        "variant": "가치평가 가",
        "gluedVariant": "가치평가가",
        "ruleStem": "가치평가",
        "ruleSuffix": "가",
        "context": "…기업 가치평가 가 중요하다…",
        "expect_boundary": False,
    },
    {
        "id": "역학은",
        "variant": "역학 은",
        "gluedVariant": "역학은",
        "ruleStem": "역학",
        "ruleSuffix": "은",
        "context": "…양자 역학 은 물리의…",
        "expect_boundary": True,
    },
    {
        "id": "활동 하도록",
        "variant": "활동 하도록",
        "gluedVariant": "활동하도록",
        "ruleStem": "활동",
        "ruleSuffix": "하도록",
        "context": "…적극 활동 하도록 권고했다…",
        "expect_boundary": True,
    },
]

SYSTEM = """당신은 한국어 교정 보조입니다. 띄어쓰기 이형태에서 규칙이 제안한 접미가
조사·어미 경계인지, 합성어·고유명 일부인지 판별하세요.
교정안을 쓰지 말고 JSON 객체 하나만 출력하세요.
필드: id, isBoundary (bool), kind (josa_or_suffix|compound_word|uncertain), confidence (high|medium|low)."""


def build_user_prompt(item: dict) -> str:
    return (
        f'id="{item["id"]}"\n'
        f'variant="{item["variant"]}" glued="{item["gluedVariant"]}"\n'
        f'ruleStem="{item["ruleStem"]}" ruleSuffix="{item["ruleSuffix"]}"\n'
        f'context="{item["context"]}"'
    )


def extract_json(text: str) -> dict | None:
    text = text.strip()
    start = text.find("{")
    if start < 0:
        return None
    snippet = text[start:]
    m = re.search(r"\{[^{}]*\}", snippet, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def main() -> int:
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print("Install: pip install 'transformers>=4.57' accelerate torch", file=sys.stderr)
        return 1

    print(f"Loading {MODEL_ID} …", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        torch_dtype="auto",
        device_map="auto",
    )

    ok_parse = 0
    ok_label = 0
    for item in FIXTURES:
        messages = [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": build_user_prompt(item)},
        ]
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            thinking_mode="no_think",
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=128,
                do_sample=False,
                temperature=None,
                top_p=None,
            )
        raw = tokenizer.decode(out[0][inputs["input_ids"].shape[1] :], skip_special_tokens=False)
        parsed = extract_json(raw)
        boundary = parsed.get("isBoundary") if parsed else None
        parse_hit = parsed is not None
        label_hit = boundary == item["expect_boundary"]
        ok_parse += int(parse_hit)
        ok_label += int(label_hit)
        print(f"\n--- {item['id']} ---")
        print("raw:", raw[:300].replace("\n", " "))
        print("parsed:", parsed)
        print("expect_boundary:", item["expect_boundary"], "→", "OK" if label_hit else "MISS")

    n = len(FIXTURES)
    print(f"\nJSON parse: {ok_parse}/{n}  boundary match: {ok_label}/{n}")
    return 0 if ok_parse == n else 2


if __name__ == "__main__":
    raise SystemExit(main())
