import csv
import time
import json
import urllib.request
import urllib.error
from typing import Dict, Any

def check_address_allocation(vault_account_id: str, blockchain: str, server_url: str = "http://localhost:8000") -> float:
    """
    Check address allocation for a vault account on a specific blockchain.

    Args:
        vault_account_id: The Fireblocks vault account ID
        blockchain: The blockchain name (e.g., 'bitcoin', 'ethereum')
        server_url: The server URL (default: localhost:8000)

    Returns:
        The allocation value as float, or 0.0 if failed
    """
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

def process_accounts_csv(input_file: str, output_file: str, server_url: str = "http://localhost:8000", max_rows: int = None):
    """
    Process the transformed accounts CSV and update claimable amounts.

    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
        server_url: Server URL for API calls
    """
    updated_data = []
    processed_count = 0
    success_count = 0
    error_count = 0

    print(f"Reading accounts from {input_file}...")
    print(f"Will make API calls to {server_url}")
    print("-" * 60)

    with open(input_file, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)

    with open(input_file, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)

        for i, row in enumerate(reader):
            if max_rows and i >= max_rows:
                break

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

            updated_data.append(updated_row)
            processed_count += 1

            if allocation_value > 0:
                success_count += 1
            else:
                error_count += 1

            # Add a small delay to avoid overwhelming the server
            time.sleep(0.1)

    # Write updated data to new CSV
    if updated_data:
        fieldnames = ['Account Id', 'Account Name', 'Asset Id', 'Claimable Amount', 'Original Claimable Amount', 'Allocation Check Result']

        print("-" * 60)
        print(f"Writing {len(updated_data)} updated accounts to {output_file}...")

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(updated_data)

        print("✅ Processing complete!")
        print(f"📊 Total processed: {processed_count}")
        print(f"✅ Successful allocations: {success_count}")
        print(f"❌ Failed allocations: {error_count}")
        print(f"📄 Output saved to: {output_file}")

    else:
        print("❌ No data to process.")

def main():
    input_file = 'transformed_accounts_sandbox.csv'
    output_file = 'accounts_with_allocations.csv'
    server_url = "http://localhost:8000"

    print("🔍 Midnight Glacier Drop - Address Allocation Checker")
    print("=" * 60)
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    print(f"Server URL: {server_url}")
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

    # For testing, let's just process the first 5 rows
    # To process ALL rows, change max_rows=5 to max_rows=None
    print("🧪 Testing with first 5 rows only...")
    process_accounts_csv(input_file, output_file, server_url, max_rows=None)

    print()
    print("💡 To process all rows, change 'max_rows=5' to 'max_rows=None' in the call above")
    print("💡 Make sure the server is running with: npm run dev")

if __name__ == "__main__":
    main()
