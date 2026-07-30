#!/usr/bin/env python3
"""
카나나-2 1.3B instruct — OpenAI 호환 로컬 추론 서버 (transformers).
vLLM/GPU 없을 때 §13 실 SLM 검증용. CPU는 느림(건당 수십 초~분).

  .venv-kanana\\Scripts\\python scripts/kanana-openai-server.py

환경:
  JOSA_SLM_SERVE_PORT=8000
  JOSA_SLM_SERVE_HOST=127.0.0.1
"""
from __future__ import annotations

import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL_ID = "kakaocorp/kanana-2-1.3b-instruct"
PORT = int(os.environ.get("JOSA_SLM_SERVE_PORT", "8000"))
HOST = os.environ.get("JOSA_SLM_SERVE_HOST", "127.0.0.1")

_model = None
_tokenizer = None


def load_model() -> None:
    global _model, _tokenizer
    if _model is not None:
        return
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print(
            "Install: .venv-kanana\\Scripts\\pip install "
            "'transformers>=4.57' accelerate torch",
            file=sys.stderr,
        )
        raise SystemExit(1)

    print(f"Loading {MODEL_ID} …", flush=True)
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    _model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        torch_dtype="auto",
        device_map="auto",
    )
    device = getattr(_model, "device", None) or next(_model.parameters()).device
    print(f"Ready on {device}", flush=True)


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


def chat_complete(messages: list[dict]) -> str:
    import torch

    assert _tokenizer is not None and _model is not None
    prompt = _tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
        thinking_mode="no_think",
    )
    inputs = _tokenizer(prompt, return_tensors="pt").to(_model.device)
    with torch.no_grad():
        out = _model.generate(
            **inputs,
            max_new_tokens=128,
            do_sample=False,
        )
    raw = _tokenizer.decode(
        out[0][inputs["input_ids"].shape[1] :],
        skip_special_tokens=True,
    )
    parsed = extract_json(raw)
    if parsed is not None:
        return json.dumps(parsed, ensure_ascii=False)
    return raw.strip()


class KananaHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[kanana-server] {self.address_string()} {fmt % args}", flush=True)

    def _send_json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/v1/models":
            self._send_json(
                200,
                {
                    "object": "list",
                    "data": [{"id": MODEL_ID, "object": "model"}],
                },
            )
            return
        self.send_error(404)

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/v1/chat/completions":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400)
            return
        messages = body.get("messages") or []
        try:
            content = chat_complete(messages)
        except Exception as exc:
            print(f"generate error: {exc}", flush=True)
            self.send_error(500)
            return
        self._send_json(
            200,
            {
                "choices": [{"message": {"role": "assistant", "content": content}}],
            },
        )


def main() -> int:
    load_model()
    server = ThreadingHTTPServer((HOST, PORT), KananaHandler)
    print(f"Kanana OpenAI server http://{HOST}:{PORT}/v1 (Ctrl+C 종료)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
