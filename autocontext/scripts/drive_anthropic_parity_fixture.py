#!/usr/bin/env python3
"""Cross-runtime parity fixture driver — Anthropic Python runtime."""
from __future__ import annotations

import gc
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parent.parent
FIXTURES_DIR = (
    ROOT.parent / "ts" / "tests" / "integrations" / "anthropic" / "parity" / "fixtures"
)

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python drive_anthropic_parity_fixture.py <fixture-name>", file=sys.stderr)
        sys.exit(1)

    fixture_name = sys.argv[1]
    fixture_dir = FIXTURES_DIR / fixture_name
    if not fixture_dir.exists():
        print(f"Fixture not found: {fixture_dir}", file=sys.stderr)
        sys.exit(1)

    request_json = json.loads((fixture_dir / "request.json").read_text())
    identity_json = json.loads((fixture_dir / "identity.json").read_text())
    is_error = (fixture_dir / "error.json").exists()
    is_streaming = (fixture_dir / "chunks.json").exists()

    import httpx

    # Build mock transport
    if is_error:
        error_json = json.loads((fixture_dir / "error.json").read_text())
        type_map = {
            "RateLimitError": "rate_limit_error",
            "OverloadedError": "overloaded_error",
            "AuthenticationError": "authentication_error",
            "PermissionDeniedError": "permission_denied_error",
            "BadRequestError": "invalid_request_error",
            "APITimeoutError": "request_too_large",
            "APIConnectionError": "api_error",
        }
        err_type = type_map.get(error_json["class"], "api_error")
        _err_data = {"status": error_json["status"], "err_type": err_type, "message": error_json["message"]}
        def _error_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=_err_data["status"],
                json={"type": "error", "error": {"type": _err_data["err_type"], "message": _err_data["message"]}},
            )
        transport = httpx.MockTransport(_error_handler)
    elif is_streaming:
        chunks = json.loads((fixture_dir / "chunks.json").read_text())
        def _stream_handler(request: httpx.Request) -> httpx.Response:
            sse_body = ""
            for chunk in chunks:
                sse_body += f"event: {chunk['type']}\ndata: {json.dumps(chunk)}\n\n"
            return httpx.Response(
                status_code=200,
                content=sse_body.encode("utf-8"),
                headers={"content-type": "text/event-stream"},
            )
        transport = httpx.MockTransport(_stream_handler)
    else:
        response_json = json.loads((fixture_dir / "response.json").read_text())
        def _json_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=200, json=response_json)
        transport = httpx.MockTransport(_json_handler)

    from anthropic import Anthropic
    from autocontext.integrations.anthropic import FileSink, instrument_client, autocontext_session

    with tempfile.TemporaryDirectory() as tmp_dir:
        trace_path = Path(tmp_dir) / "traces.jsonl"
        sink = FileSink(trace_path, batch_size=1, flush_interval_seconds=0)

        # Handle install-salt for session fixtures
        salt_file = fixture_dir / "install-salt.txt"
        original_dir = os.getcwd()
        changed_dir = False
        if salt_file.exists():
            salt_dir = Path(tmp_dir) / "salt"
            salt_dir.mkdir(exist_ok=True)
            (salt_dir / ".autocontext").mkdir(exist_ok=True)
            (salt_dir / ".autocontext" / "install-salt").write_text(salt_file.read_text().strip())
            os.chdir(salt_dir)
            changed_dir = True

        try:
            http_client = httpx.Client(transport=transport, base_url="https://api.anthropic.com")
            inner = Anthropic(api_key="test-key", http_client=http_client)
            client = instrument_client(inner, sink=sink, app_id="parity-test-app", environment_tag="test")

            def run_request() -> None:
                if is_streaming:
                    try:
                        request_kwargs = {**request_json, "stream": True}
                        stream = client.messages.create(**request_kwargs)
                        if fixture_name == "messages-streaming-abandoned":
                            it = iter(stream)
                            next(it)
                            del stream
                            del it
                            gc.collect()
                        else:
                            for _event in stream:
                                pass
                    except Exception:
                        pass
                else:
                    try:
                        client.messages.create(**request_json)
                    except Exception:
                        pass
                sink.flush()
                sink.close()

            if identity_json.get("userId") or identity_json.get("sessionId"):
                with autocontext_session(
                    user_id=identity_json.get("userId"),
                    session_id=identity_json.get("sessionId"),
                ):
                    run_request()
            else:
                run_request()

            content = trace_path.read_text().strip()
            if not content:
                print("No trace emitted", file=sys.stderr)
                sys.exit(1)

            raw_trace = json.loads(content.split("\n")[0])
        finally:
            if changed_dir:
                os.chdir(original_dir)

    normalized = normalize_trace(raw_trace, fixture_name)
    print(canonical_json(normalized))


def normalize_trace(trace: dict[str, Any], fixture_name: str) -> dict[str, Any]:
    t = dict(trace)
    t["traceId"] = "PARITY_TRACE_ID_NORMALIZED"
    t["timing"] = {"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 1000}
    if isinstance(t.get("source"), dict) and isinstance(t["source"].get("sdk"), dict):
        t["source"] = dict(t["source"])
        t["source"]["sdk"] = {"name": "autocontext-sdk", "version": "0.0.0"}
    if isinstance(t.get("messages"), list):
        t["messages"] = [{**m, "timestamp": "2024-01-01T00:00:00Z"} for m in t["messages"]]
    if isinstance(t.get("outcome"), dict) and isinstance(t["outcome"].get("error"), dict):
        t["outcome"] = dict(t["outcome"])
        err = dict(t["outcome"]["error"])
        if "stack" in err: err["stack"] = "NORMALIZED"
        if "message" in err: err["message"] = "NORMALIZED"
        if "type" in err: err["type"] = "NORMALIZED"
        t["outcome"]["error"] = err
    return t


def canonical_json(obj: Any) -> str:
    if isinstance(obj, list):
        return "[" + ",".join(canonical_json(v) for v in obj) + "]"
    if isinstance(obj, dict):
        keys = sorted(obj.keys())
        return "{" + ",".join(json.dumps(k) + ":" + canonical_json(obj[k]) for k in keys) + "}"
    if obj is None:
        return "null"
    return json.dumps(obj)


if __name__ == "__main__":
    main()
