import csv
import time
import json
import urllib.request
import urllib.error
from typing import Dict, Any

def check_address_allocation(vault_account_id: str, blockchain: str, server_url: str = "http://localhost:8000") -> float:
    url = f"{server_url}/api/check/{blockchain}/{vault_account_id}"

    try:
        print(f"Checking allocation for vault {vault_account_id} on {blockchain}...")
        req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})

        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                response_data = json.loads(response.read().decode('utf-8'))
                if 'value' in response_data and response_data['value'] is not None:
                    value = float(response_data['value'])
                    print(f"  ✓ Success: {value}")
                    return value
                else:
                    print(f"  ⚠ No value in response: {response_data}")
                    return 0.0
            else:
                print(f"  ✗ HTTP {response.status}: {response.read().decode('utf-8')}")
                return 0.0

    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {e.read().decode('utf-8')}")
        return 0.0
    except urllib.error.URLError as e:
        print(f"  ✗ URL error for vault {vault_account_id}: {e}")
        return 0.0
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON parsing error for vault {vault_account_id}: {e}")
        return 0.0
    except (ValueError, KeyError) as e:
        print(f"  ✗ Data parsing error for vault {vault_account_id}: {e}")
        return 0.0
    except Exception as e:
        print(f"  ✗ Unexpected error for vault {vault_account_id}: {e}")
        return 0.0

def get_pool_metrics(server_url: str = "http://localhost:8000") -> Dict[str, Any]:
    """
    Get SDK pool metrics from the server.

    Args:
        server_url: The server URL

    Returns:
        Pool metrics dictionary, or empty dict if failed
    """
    url = f"{server_url}/metrics"

    try:
        req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
            else:
                print(f"⚠ Failed to get pool metrics: HTTP {response.status}")
                return {}
    except Exception as e:
        print(f"⚠ Failed to get pool metrics: {e}")
        return {}

def clear_pool(server_url: str = "http://localhost:8000") -> bool:
    """
    Clear idle SDK instances from the pool.

    Args:
        server_url: The server URL

    Returns:
        True if successful, False otherwise
    """
    url = f"{server_url}/clear-pool"

    try:
        req = urllib.request.Request(url, method='POST', headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                result = json.loads(response.read().decode('utf-8'))
                print(f"🧹 Pool cleared: {result.get('message', 'Success')}")
                return True
            else:
                print(f"⚠ Failed to clear pool: HTTP {response.status}")
                return False
    except Exception as e:
        print(f"⚠ Failed to clear pool: {e}")
        return False

def check_and_clear_pool_if_needed(server_url: str = "http://localhost:8000", pool_max_size: int = 200, threshold_percent: float = 80.0) -> bool:
    """
    Check pool metrics and clear idle instances if pool usage is above threshold.

    Args:
        server_url: The server URL
        pool_max_size: Maximum pool size
        threshold_percent: Percentage threshold to trigger clearing (0-100)

    Returns:
        True if pool was cleared, False otherwise
    """
    metrics = get_pool_metrics(server_url)

    if not metrics:
        return False

    total_instances = metrics.get('totalInstances', 0)
    threshold = int(pool_max_size * threshold_percent / 100.0)

    if total_instances >= threshold:
        print(f"🔥 Pool usage high: {total_instances}/{pool_max_size} instances ({threshold_percent}% threshold)")
        return clear_pool(server_url)
    else:
        print(f"✅ Pool usage OK: {total_instances}/{pool_max_size} instances")
        return False

def process_accounts_csv(input_file: str, output_file: str, server_url: str = "http://localhost:8000", max_rows: int = None, batch_size: int = 100, batch_delay: int = 20):
    """
    Process the transformed accounts CSV and update claimable amounts with batching and rate limiting.

    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
        server_url: Server URL for API calls
        max_rows: Maximum number of rows to process (None for all)
        batch_size: Number of rows to process per batch
        batch_delay: Seconds to wait between batches
    """
    all_updated_data = []
    total_processed = 0
    total_success = 0
    total_error = 0
    batch_number = 1

    print(f"Reading accounts from {input_file}...")
    print(f"Will make API calls to {server_url}")
    print(f"Processing in batches of {batch_size} with {batch_delay}s delay between batches")
    print("-" * 80)

    # Read all rows first
    all_rows = []
    with open(input_file, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            all_rows.append(row)

    # Limit rows if specified
    if max_rows:
        all_rows = all_rows[:max_rows]

    print(f"Total rows to process: {len(all_rows)}")

    # Process in batches
    for i in range(0, len(all_rows), batch_size):
        batch_rows = all_rows[i:i + batch_size]
        batch_data = []

        print(f"\n🔄 Processing batch {batch_number} ({len(batch_rows)} rows, indices {i}-{min(i+batch_size-1, len(all_rows)-1)})")
        print("-" * 60)

        # Check pool usage before processing batch
        pool_cleared = check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=80.0)
        if pool_cleared:
            print("⏳ Waiting 2 seconds after pool clearing...")
            time.sleep(2)

        batch_processed = 0
        batch_success = 0
        batch_error = 0

        for row in batch_rows:
            vault_account_id = row.get('Account Id', '').strip()
            blockchain = row.get('Asset Id', '').strip()
            account_name = row.get('Account Name', '').strip()
            original_claimable = row.get('Claimable Amount', '0').strip()

            if not vault_account_id or not blockchain:
                print(f"⚠ Skipping row with missing data: {row}")
                continue

            # Check address allocation
            allocation_value = check_address_allocation(vault_account_id, blockchain, server_url)

            # Update the row with the new claimable amount
            updated_row = {
                'Account Id': vault_account_id,
                'Account Name': account_name,
                'Asset Id': blockchain,
                'Claimable Amount': str(allocation_value) if allocation_value > 0 else original_claimable,
                'Original Claimable Amount': original_claimable,
                'Allocation Check Result': 'Success' if allocation_value > 0 else 'Failed/Using Original'
            }

            batch_data.append(updated_row)
            batch_processed += 1

            if allocation_value > 0:
                batch_success += 1
            else:
                batch_error += 1

            # Add a small delay to avoid overwhelming the server
            time.sleep(0.1)

        # Add batch data to overall data
        all_updated_data.extend(batch_data)

        # Update totals
        total_processed += batch_processed
        total_success += batch_success
        total_error += batch_error

        # Write batch results to file
        fieldnames = ['Account Id', 'Account Name', 'Asset Id', 'Claimable Amount', 'Original Claimable Amount', 'Allocation Check Result']

        print("-" * 60)
        print(f"📝 Writing batch {batch_number} results to {output_file}...")
        print(f"   Batch stats: {batch_processed} processed, {batch_success} success, {batch_error} failed")

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_updated_data)

        print(f"   ✅ Batch {batch_number} saved. Cumulative total: {total_processed} rows")

        # Check and clear pool after batch processing
        print("🔍 Checking pool after batch processing...")
        check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=50.0)

        # Check if this is the last batch
        if i + batch_size >= len(all_rows):
            break

        # Wait before next batch (unless it's the last one)
        print(f"⏳ Waiting {batch_delay} seconds before next batch...")
        time.sleep(batch_delay)
        batch_number += 1

    # Final summary
    print("\n" + "=" * 80)
    print("🎉 PROCESSING COMPLETE!")
    print("=" * 80)
    print(f"📊 Total processed: {total_processed}")
    print(f"✅ Successful allocations: {total_success}")
    print(f"❌ Failed allocations: {total_error}")
    print(f"📄 Final output saved to: {output_file}")
    print(f"📦 Processed in {batch_number} batches of up to {batch_size} rows each")

def main():
    # Use relative path to access files from parent directory
    input_file = 'transformed_accounts.csv'
    output_file = 'accounts_with_allocations.csv'
    server_url = "http://localhost:8000"

    # Rate limiting configuration
    BATCH_SIZE = 50  # Process 50 entries per batch (reduced from 100)
    BATCH_DELAY = 20  # Wait 20 seconds between batches

    print("🔍 Midnight Glacier Drop - Address Allocation Checker")
    print("=" * 80)
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    print(f"Server URL: {server_url}")
    print(f"Batch size: {BATCH_SIZE} entries")
    print(f"Batch delay: {BATCH_DELAY} seconds")
    print()

    # Check if server is running
    try:
        req = urllib.request.Request(f"{server_url}/health")
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print("✅ Server is running and healthy")
            else:
                print(f"⚠ Server health check returned status {response.status}")
                print("Continuing anyway...")
    except Exception as e:
        print(f"❌ Cannot connect to server at {server_url}: {e}")
        print("Please make sure the server is running with: npm run dev")
        print("Continuing anyway for testing purposes...")
        print()

    # Process all rows with batching
    print("🚀 Starting batch processing...")
    process_accounts_csv(input_file, output_file, server_url, max_rows=None, batch_size=BATCH_SIZE, batch_delay=BATCH_DELAY)

if __name__ == "__main__":
    main()
