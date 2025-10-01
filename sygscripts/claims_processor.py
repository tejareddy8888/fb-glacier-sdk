import csv
import time
import json
import urllib.request
import urllib.error
import os
import argparse
from typing import Dict, Any, Optional
from tqdm import tqdm

def check_address_eligibility(vault_account_id: str, blockchain: str, server_url: str = "http://localhost:8000") -> Optional[float]:
    """
    Check if vault account is eligible for claims by fetching allocation value.

    Args:
        vault_account_id: The vault account ID
        blockchain: The blockchain/asset ID
        server_url: The server URL

    Returns:
        Claimable amount if eligible, None if not eligible
    """
    url = f"{server_url}/api/check/{blockchain}/{vault_account_id}"

    try:
        print(f"Checking eligibility for vault {vault_account_id} on {blockchain}...")
        req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})

        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                response_data = json.loads(response.read().decode('utf-8'))
                if 'value' in response_data and response_data['value'] is not None:
                    value = float(response_data['value'])
                    if value > 0:
                        print(f"  ✓ Eligible: {value}")
                        return value
                    else:
                        print(f"  ✗ Not eligible: {value}")
                        return None
                else:
                    print(f"  ✗ No value in response: {response_data}")
                    return None
            else:
                print(f"  ✗ HTTP {response.status}: {response.read().decode('utf-8')}")
                return None

    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {e.read().decode('utf-8')}")
        return None
    except urllib.error.URLError as e:
        print(f"  ✗ URL error for vault {vault_account_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON parsing error for vault {vault_account_id}: {e}")
        return None
    except (ValueError, KeyError) as e:
        print(f"  ✗ Data parsing error for vault {vault_account_id}: {e}")
        return None
    except Exception as e:
        print(f"  ✗ Unexpected error for vault {vault_account_id}: {e}")
        return None

def check_claims_history(vault_account_id: str, blockchain: str, server_url: str = "http://localhost:8000") -> Optional[list]:
    """
    Check if claims have already been performed for this vault account.

    Args:
        vault_account_id: The vault account ID
        blockchain: The blockchain/asset ID
        server_url: The server URL

    Returns:
        List of claims if any exist, None if no claims or error
    """
    url = f"{server_url}/api/claims/{blockchain}/{vault_account_id}"

    try:
        print(f"Checking claims history for vault {vault_account_id} on {blockchain}...")
        req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})

        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                claims = json.loads(response.read().decode('utf-8'))
                if claims and len(claims) > 0:
                    print(f"  ✓ Found {len(claims)} existing claims")
                    return claims
                else:
                    print(f"  ✓ No existing claims found")
                    return []
            else:
                print(f"  ✗ HTTP {response.status}: {response.read().decode('utf-8')}")
                return None

    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {e.read().decode('utf-8')}")
        return None
    except urllib.error.URLError as e:
        print(f"  ✗ URL error for vault {vault_account_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON parsing error for vault {vault_account_id}: {e}")
        return None
    except Exception as e:
        print(f"  ✗ Unexpected error for vault {vault_account_id}: {e}")
        return None

def make_claim(vault_account_id: str, blockchain: str, destination_address: str, server_url: str = "http://localhost:8000") -> Optional[Dict[str, Any]]:
    """
    Make a claim for the vault account.

    Args:
        vault_account_id: The vault account ID
        blockchain: The blockchain/asset ID
        destination_address: The destination address for the claim
        server_url: The server URL

    Returns:
        Claim response if successful, None if failed
    """
    url = f"{server_url}/api/claims/{blockchain}"

    try:
        print(f"Making claim for vault {vault_account_id} on {blockchain} to {destination_address}...")
        data = {
            "originVaultAccountId": vault_account_id,
            "destinationAddress": destination_address
        }
        json_data = json.dumps(data).encode('utf-8')

        req = urllib.request.Request(url, data=json_data, method='POST', headers={'Content-Type': 'application/json'})

        with urllib.request.urlopen(req, timeout=60) as response:
            if response.status == 200:
                result = json.loads(response.read().decode('utf-8'))
                print(f"  ✓ Claim successful")
                return result
            else:
                print(f"  ✗ HTTP {response.status}: {response.read().decode('utf-8')}")
                return None

    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {e.read().decode('utf-8')}")
        return None
    except urllib.error.URLError as e:
        print(f"  ✗ URL error for vault {vault_account_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON parsing error for vault {vault_account_id}: {e}")
        return None
    except Exception as e:
        print(f"  ✗ Unexpected error for vault {vault_account_id}: {e}")
        return None

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

def process_claims_csv(input_file: str, output_file: str, destination_address: str, server_url: str = "http://localhost:8000", max_rows: int = None, batch_size: int = 50, batch_delay: int = 20):
    """
    Process the accounts CSV and perform claims workflow with batching and rate limiting.

    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
        destination_address: Destination address for claims
        server_url: Server URL for API calls
        max_rows: Maximum number of rows to process (None for all)
        batch_size: Number of rows to process per batch
        batch_delay: Seconds to wait between batches
    """
    all_updated_data = []
    total_processed = 0
    total_eligible = 0
    total_already_claimed = 0
    total_claimed = 0
    total_unclaimable = 0
    batch_number = 1

    print(f"Reading accounts from {input_file}...")
    print(f"Will make API calls to {server_url}")
    print(f"Destination address for claims: {destination_address}")
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

    # Create overall progress bar for batches
    with tqdm(total=len(all_rows), desc="Overall Progress", unit="accounts") as overall_pbar:
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
            batch_eligible = 0
            batch_already_claimed = 0
            batch_claimed = 0
            batch_unclaimable = 0

            # Step 1: Check eligibility for all accounts in batch
            print("📋 Step 1: Checking eligibility for all accounts in batch...")
            eligibility_results = {}
            with tqdm(total=len(batch_rows), desc="Eligibility Check", unit="accounts", leave=False) as pbar:
                for row in batch_rows:
                    vault_account_id = row.get('Account Id', '').strip()
                    blockchain = row.get('Asset Id', '').strip()

                    if not vault_account_id or not blockchain:
                        eligibility_results[vault_account_id] = None
                        pbar.update(1)
                        continue

                    claimable_value = check_address_eligibility(vault_account_id, blockchain, server_url)
                    eligibility_results[vault_account_id] = claimable_value

                    pbar.update(1)
                    # Small delay between individual API calls
                    time.sleep(0.1)

            # Clear pool after eligibility checks
            print("🧹 Clearing pool after eligibility checks...")
            check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=60.0)
            time.sleep(1)

            # Step 2: Check claims history for eligible accounts
            print("📋 Step 2: Checking claims history for eligible accounts...")
            claims_history_results = {}
            eligible_count = sum(1 for v in eligibility_results.values() if v is not None)
            with tqdm(total=len(batch_rows), desc="Claims History", unit="accounts", leave=False) as pbar:
                for row in batch_rows:
                    vault_account_id = row.get('Account Id', '').strip()
                    blockchain = row.get('Asset Id', '').strip()

                    if not vault_account_id or not blockchain:
                        claims_history_results[vault_account_id] = None
                        pbar.update(1)
                        continue

                    claimable_value = eligibility_results.get(vault_account_id)
                    if claimable_value is None:
                        claims_history_results[vault_account_id] = None
                        pbar.update(1)
                        continue

                    claims_history = check_claims_history(vault_account_id, blockchain, server_url)
                    claims_history_results[vault_account_id] = claims_history

                    pbar.update(1)
                    # Small delay between individual API calls
                    time.sleep(0.1)

            # Clear pool after claims history checks
            print("🧹 Clearing pool after claims history checks...")
            check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=60.0)
            time.sleep(1)

            # Step 3: Make claims for accounts that need them (this step takes longest)
            print("📋 Step 3: Making claims for eligible accounts with no existing claims...")
            claim_results = {}
            accounts_needing_claims = sum(1 for row in batch_rows
                                        if eligibility_results.get(row.get('Account Id', '').strip()) is not None
                                        and claims_history_results.get(row.get('Account Id', '').strip()) == [])
            with tqdm(total=len(batch_rows), desc="Claim Submissions", unit="accounts", leave=False) as pbar:
                for row in batch_rows:
                    vault_account_id = row.get('Account Id', '').strip()
                    blockchain = row.get('Asset Id', '').strip()
                    account_name = row.get('Account Name', '').strip()
                    original_claimable = row.get('Claimable Amount', '0').strip()

                    if not vault_account_id or not blockchain:
                        print(f"⚠ Skipping row with missing data: {row}")
                        pbar.update(1)
                        continue

                    eligibility_status = "Unknown"
                    claim_status = "Not Processed"
                    claim_result = "N/A"
                    claimable_amount = original_claimable

                    # Get eligibility result
                    claimable_value = eligibility_results.get(vault_account_id)

                    if claimable_value is None:
                        eligibility_status = "Unclaimable"
                        claim_status = "Skipped"
                        total_unclaimable += 1
                        batch_unclaimable += 1
                    else:
                        eligibility_status = "Eligible"
                        claimable_amount = str(claimable_value)
                        total_eligible += 1
                        batch_eligible += 1

                        # Get claims history result
                        claims_history = claims_history_results.get(vault_account_id)

                        if claims_history is None:
                            # Error checking claims, skip this account
                            claim_status = "Error Checking Claims"
                        elif len(claims_history) > 0:
                            claim_status = "Already Claimed"
                            total_already_claimed += 1
                            batch_already_claimed += 1
                        else:
                            # Make claim (this is the long-running operation)
                            claim_result_data = make_claim(vault_account_id, blockchain, destination_address, server_url)
                            if claim_result_data:
                                claim_status = "Claimed Successfully"
                                claim_result = json.dumps(claim_result_data)
                                total_claimed += 1
                                batch_claimed += 1
                            else:
                                claim_status = "Claim Failed"
                                claim_result = "Failed to process claim"

                    # Update the row with results
                    updated_row = {
                        'Account Id': vault_account_id,
                        'Account Name': account_name,
                        'Asset Id': blockchain,
                        'Claimable Amount': claimable_amount,
                        'Eligibility Status': eligibility_status,
                        'Claim Status': claim_status,
                        'Claim Result': claim_result
                    }

                    batch_data.append(updated_row)
                    batch_processed += 1

                    pbar.update(1)
                    # Small delay between claim submissions (longer delay for the slow POST calls)
                    time.sleep(0.5)

            # Add batch data to overall data
            all_updated_data.extend(batch_data)

            # Update totals
            total_processed += batch_processed

            # Update overall progress bar
            overall_pbar.update(len(batch_rows))

            # Write batch results to file
            fieldnames = ['Account Id', 'Account Name', 'Asset Id', 'Claimable Amount', 'Eligibility Status', 'Claim Status', 'Claim Result']

            print("-" * 60)
            print(f"📝 Writing batch {batch_number} results to {output_file}...")
            print(f"   Batch stats: {batch_processed} processed, {batch_eligible} eligible, {batch_already_claimed} already claimed, {batch_claimed} claimed, {batch_unclaimable} unclaimable")

            with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(all_updated_data)

            print(f"   ✅ Batch {batch_number} saved. Cumulative total: {total_processed} rows")

            # Check and clear pool after batch processing (final cleanup)
            print("🔍 Checking pool after batch processing...")
            check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=50.0)

            # Check if this is the last batch
            if i + batch_size >= len(all_rows):
                break

            # Wait before next batch (unless it's the last one)
            print(f"⏳ Waiting {batch_delay} seconds before next batch...")
            time.sleep(batch_delay)
            batch_number += 1

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
        batch_eligible = 0
        batch_already_claimed = 0
        batch_claimed = 0
        batch_unclaimable = 0

        # Step 1: Check eligibility for all accounts in batch
        print("📋 Step 1: Checking eligibility for all accounts in batch...")
        eligibility_results = {}
        for row in batch_rows:
            vault_account_id = row.get('Account Id', '').strip()
            blockchain = row.get('Asset Id', '').strip()

            if not vault_account_id or not blockchain:
                eligibility_results[vault_account_id] = None
                continue

            claimable_value = check_address_eligibility(vault_account_id, blockchain, server_url)
            eligibility_results[vault_account_id] = claimable_value

            # Small delay between individual API calls
            time.sleep(0.1)

        # Clear pool after eligibility checks
        print("🧹 Clearing pool after eligibility checks...")
        check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=60.0)
        time.sleep(1)

        # Step 2: Check claims history for eligible accounts
        print("📋 Step 2: Checking claims history for eligible accounts...")
        claims_history_results = {}
        for row in batch_rows:
            vault_account_id = row.get('Account Id', '').strip()
            blockchain = row.get('Asset Id', '').strip()

            if not vault_account_id or not blockchain:
                claims_history_results[vault_account_id] = None
                continue

            claimable_value = eligibility_results.get(vault_account_id)
            if claimable_value is None:
                claims_history_results[vault_account_id] = None
                continue

            claims_history = check_claims_history(vault_account_id, blockchain, server_url)
            claims_history_results[vault_account_id] = claims_history

            # Small delay between individual API calls
            time.sleep(0.1)

        # Clear pool after claims history checks
        print("🧹 Clearing pool after claims history checks...")
        check_and_clear_pool_if_needed(server_url, pool_max_size=200, threshold_percent=60.0)
        time.sleep(1)

        # Step 3: Make claims for accounts that need them (this step takes longest)
        print("📋 Step 3: Making claims for eligible accounts with no existing claims...")
        claim_results = {}
        for row in batch_rows:
            vault_account_id = row.get('Account Id', '').strip()
            blockchain = row.get('Asset Id', '').strip()
            account_name = row.get('Account Name', '').strip()
            original_claimable = row.get('Claimable Amount', '0').strip()

            if not vault_account_id or not blockchain:
                print(f"⚠ Skipping row with missing data: {row}")
                continue

            eligibility_status = "Unknown"
            claim_status = "Not Processed"
            claim_result = "N/A"
            claimable_amount = original_claimable

            # Get eligibility result
            claimable_value = eligibility_results.get(vault_account_id)

            if claimable_value is None:
                eligibility_status = "Unclaimable"
                claim_status = "Skipped"
                total_unclaimable += 1
                batch_unclaimable += 1
            else:
                eligibility_status = "Eligible"
                claimable_amount = str(claimable_value)
                total_eligible += 1
                batch_eligible += 1

                # Get claims history result
                claims_history = claims_history_results.get(vault_account_id)

                if claims_history is None:
                    # Error checking claims, skip this account
                    claim_status = "Error Checking Claims"
                elif len(claims_history) > 0:
                    claim_status = "Already Claimed"
                    total_already_claimed += 1
                    batch_already_claimed += 1
                else:
                    # Make claim (this is the long-running operation)
                    claim_result_data = make_claim(vault_account_id, blockchain, destination_address, server_url)
                    if claim_result_data:
                        claim_status = "Claimed Successfully"
                        claim_result = json.dumps(claim_result_data)
                        total_claimed += 1
                        batch_claimed += 1
                    else:
                        claim_status = "Claim Failed"
                        claim_result = "Failed to process claim"

            # Update the row with results
            updated_row = {
                'Account Id': vault_account_id,
                'Account Name': account_name,
                'Asset Id': blockchain,
                'Claimable Amount': claimable_amount,
                'Eligibility Status': eligibility_status,
                'Claim Status': claim_status,
                'Claim Result': claim_result
            }

            batch_data.append(updated_row)
            batch_processed += 1

            # Small delay between claim submissions (longer delay for the slow POST calls)
            time.sleep(0.5)

        # Add batch data to overall data
        all_updated_data.extend(batch_data)

        # Update totals
        total_processed += batch_processed

        # Write batch results to file
        fieldnames = ['Account Id', 'Account Name', 'Asset Id', 'Claimable Amount', 'Eligibility Status', 'Claim Status', 'Claim Result']

        print("-" * 60)
        print(f"📝 Writing batch {batch_number} results to {output_file}...")
        print(f"   Batch stats: {batch_processed} processed, {batch_eligible} eligible, {batch_already_claimed} already claimed, {batch_claimed} claimed, {batch_unclaimable} unclaimable")

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_updated_data)

        print(f"   ✅ Batch {batch_number} saved. Cumulative total: {total_processed} rows")

        # Check and clear pool after batch processing (final cleanup)
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
    print("🎉 CLAIMS PROCESSING COMPLETE!")
    print("=" * 80)
    print(f"📊 Total processed: {total_processed}")
    print(f"✅ Eligible accounts: {total_eligible}")
    print(f"📋 Already claimed: {total_already_claimed}")
    print(f"🎁 Successfully claimed: {total_claimed}")
    print(f"❌ Unclaimable accounts: {total_unclaimable}")
    print(f"📄 Final output saved to: {output_file}")
    print(f"📦 Processed in {batch_number} batches of up to {batch_size} rows each")

def main():
    parser = argparse.ArgumentParser(description="Midnight Glacier Drop - Claims Processor")
    parser.add_argument('--batch-size', type=int, default=25, help='Number of accounts to process per batch (default: 25)')
    parser.add_argument('--destination-address', type=str, default='addr1w8p79rpkcdz8x9d6tft0x0dx5mwuzac2sa4gm8cvkw5hcnqst2ctf', help='Destination address for claims')

    args = parser.parse_args()
    # Configuration
    input_file = 'transformed_accounts_sandbox.csv'
    output_file = 'accounts_with_claims.csv'
    server_url = "http://localhost:8000"

    # Get destination address from environment variable
    destination_address = args.destination_address

    # Rate limiting configuration
    BATCH_SIZE = args.batch_size  # Process fewer accounts per batch due to more API calls
    BATCH_DELAY = 30  # Longer delay between batches

    print("🔍 Midnight Glacier Drop - Claims Processor")
    print("=" * 80)
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    print(f"Server URL: {server_url}")
    print(f"Destination address: {destination_address}")
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
    print("🚀 Starting claims processing...")
    process_claims_csv(input_file, output_file, destination_address, server_url, max_rows=None, batch_size=BATCH_SIZE, batch_delay=BATCH_DELAY)

if __name__ == "__main__":
    main()