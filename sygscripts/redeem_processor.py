"""Midnight Glacier Drop - NIGHT redemption for a single Fireblocks address.

Drives the redeem flow exposed by the local TS server (`src/server.ts`) for one
(vault account, address index) pair:

  1. Fetches phase config and the thaw schedule for the address.
  2. If at least one thaw is `redeemable`, POSTs `/api/thaws/redeem/<vault>?index=<idx>`.
  3. Optionally polls until the redemption is confirmed/failed.

Run the TS server first (`npm run dev`), then for example:
  python redeem_processor.py \
      --vault-account-id 123 \
      --index 0 \
      --address addr1qx... \
      --wait-for-confirmation

`--address` is the Cardano destination address for the (vault, index) pair.
It is used for status lookups and is sanity-checked against the schedule.
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional


DEFAULT_SERVER = "http://localhost:8000"


def _request(
    method: str,
    url: str,
    body: Optional[Dict[str, Any]] = None,
    timeout: int = 60,
) -> Optional[Any]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
            if response.status == 200:
                return json.loads(payload) if payload else {}
            print(f"  ✗ HTTP {response.status}: {payload}")
            return None
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"  ✗ HTTP {e.code}: {body_text}")
        return None
    except urllib.error.URLError as e:
        print(f"  ✗ URL error: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON parsing error: {e}")
        return None
    except Exception as e:  # noqa: BLE001
        print(f"  ✗ Unexpected error: {e}")
        return None


def server_healthy(server_url: str) -> bool:
    try:
        req = urllib.request.Request(f"{server_url}/health")
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except Exception:  # noqa: BLE001
        return False


def get_phase_config(server_url: str) -> Optional[Dict[str, Any]]:
    result = _request("GET", f"{server_url}/api/thaws/phase-config", timeout=30)
    return result.get("result") if isinstance(result, dict) else None


def get_thaw_schedule(
    server_url: str, vault_account_id: str, index: int
) -> Optional[Dict[str, Any]]:
    qs = urllib.parse.urlencode({"index": index})
    url = f"{server_url}/api/thaws/thaw-schedule/{vault_account_id}?{qs}"
    result = _request("GET", url, timeout=30)
    return result.get("result") if isinstance(result, dict) else None


def get_thaw_status(
    server_url: str, dest_address: str, transaction_id: str
) -> Optional[Dict[str, Any]]:
    url = f"{server_url}/api/thaws/status/{dest_address}/{transaction_id}"
    result = _request("GET", url, timeout=30)
    return result.get("result") if isinstance(result, dict) else None


def redeem_night(
    server_url: str,
    vault_account_id: str,
    index: int,
    wait_for_confirmation: bool,
    polling_interval_ms: int,
    timeout_ms: int,
) -> Optional[Dict[str, Any]]:
    qs = urllib.parse.urlencode({"index": index})
    url = f"{server_url}/api/thaws/redeem/{vault_account_id}?{qs}"
    body = {
        "waitForConfirmation": wait_for_confirmation,
        "pollingIntervalMs": polling_interval_ms,
        "timeoutMs": timeout_ms,
    }
    client_timeout = (
        max(120, (timeout_ms // 1000) + 60) if wait_for_confirmation else 120
    )
    result = _request("POST", url, body=body, timeout=client_timeout)
    return result.get("result") if isinstance(result, dict) else None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Redeem NIGHT tokens for a single Fireblocks vault address."
    )
    parser.add_argument(
        "--vault-account-id",
        required=True,
        help="Fireblocks vault account ID holding the Cardano address",
    )
    parser.add_argument(
        "--index",
        type=int,
        default=0,
        help="bip44 address index under the vault account (default: 0)",
    )
    parser.add_argument(
        "--address",
        required=True,
        help="Cardano destination address (Bech32, addr1...) for the (vault, index) pair",
    )
    parser.add_argument(
        "--server-url",
        default=DEFAULT_SERVER,
        help=f"Local TS server URL (default: {DEFAULT_SERVER})",
    )
    parser.add_argument(
        "--wait-for-confirmation",
        action="store_true",
        help="Block until the redemption is confirmed or fails on-chain",
    )
    parser.add_argument(
        "--polling-interval-ms",
        type=int,
        default=15000,
        help="Server-side polling interval when waiting for confirmation (default: 15000)",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=300000,
        help="Server-side confirmation timeout in ms (default: 300000)",
    )
    parser.add_argument(
        "--skip-schedule-check",
        action="store_true",
        help="Skip the pre-flight thaw-schedule check (the SDK still validates)",
    )

    args = parser.parse_args()

    print("🌙 Midnight Glacier Drop - Single Address Redeem")
    print("=" * 64)
    print(f"Server URL:       {args.server_url}")
    print(f"Vault account ID: {args.vault_account_id}")
    print(f"Address index:    {args.index}")
    print(f"Cardano address:  {args.address}")
    print(f"Wait for confirm: {args.wait_for_confirmation}")
    print()

    if not server_healthy(args.server_url):
        print(f"❌ Cannot reach server at {args.server_url} — is `npm run dev` running?")
        return 2

    phase = get_phase_config(args.server_url)
    if phase:
        print(
            f"📅 Phase config: genesis={phase.get('genesis_timestamp')}, "
            f"increments={phase.get('redemption_increments')}, "
            f"period={phase.get('redemption_increment_period')}s"
        )
    else:
        print("⚠ Could not load phase config — continuing; the SDK validates per-call")

    if not args.skip_schedule_check:
        schedule = get_thaw_schedule(args.server_url, args.vault_account_id, args.index)
        if schedule is None:
            print("❌ Failed to fetch thaw schedule, aborting")
            return 3
        thaws = schedule.get("thaws", []) or []
        redeemable = [t for t in thaws if t.get("status") == "redeemable"]
        print(
            f"📋 Schedule: {len(thaws)} thaw(s) total, "
            f"{len(redeemable)} redeemable"
        )
        if not redeemable:
            print("⏸ Nothing redeemable for this address right now")
            return 1

    print()
    print("🚀 Submitting redemption…")
    redemption = redeem_night(
        args.server_url,
        args.vault_account_id,
        args.index,
        wait_for_confirmation=args.wait_for_confirmation,
        polling_interval_ms=args.polling_interval_ms,
        timeout_ms=args.timeout_ms,
    )

    if not redemption:
        print("❌ Redeem failed — see server logs")
        return 4

    print()
    print("✅ Redemption submitted")
    print(json.dumps(redemption, indent=2))

    tx_id = redemption.get("transaction_id")
    if tx_id and not args.wait_for_confirmation:
        print()
        print(f"🔎 Status check for {tx_id}…")
        status = get_thaw_status(args.server_url, args.address, tx_id)
        if status:
            print(json.dumps(status, indent=2))

    final_status = redemption.get("finalStatus")
    if final_status == "failed":
        return 5
    return 0


if __name__ == "__main__":
    sys.exit(main())
