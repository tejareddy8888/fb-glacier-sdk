import csv

# Supported blockchains (matching the SupportedBlockchains enum)
supported_blockchains = {
    'avalanche',  # Note: enum uses 'avax' but we transform to 'avalanche'
    'bitcoin',
    'bnb',
    'cardano',
    'ethereum',
    'solana',
    'xrp'
}

def transform_asset_id(asset_id):
    """Transform Asset Id to blockchain name"""
    # Only map these specific assets
    asset_to_blockchain = {
        'ADA': 'cardano',
        'AVAX': 'avalanche',
        'BTC': 'bitcoin',
        'BNB': 'bnb',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'XRP': 'xrp',
    }

    # Remove test suffixes and clean up asset ID
    clean_asset = asset_id.replace('_TEST', '').split('_')[0]

    blockchain = asset_to_blockchain.get(clean_asset)

    # Only return supported blockchains
    return blockchain if blockchain in supported_blockchains else None

def main():
    input_file = 'prd_data.csv'
    output_file = 'transformed_accounts.csv'

    transformed_data = []

    with open(input_file, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)

        for row in reader:
            # Skip rows with zero available balance
            available_balance = float(row.get('Available Balance', '0') or '0')
            if available_balance <= 0:
                continue

            asset_id = row.get('Asset Id', '')
            blockchain = transform_asset_id(asset_id)

            # Skip assets that are not supported
            if blockchain is None:
                continue

            transformed_row = {
                'Account Id': row.get('Account Id', ''),
                'Account Name': row.get('Account Name', ''),
                'Asset Id': blockchain,
                'Claimable Amount': row.get('Available Balance', '0')
            }
            transformed_data.append(transformed_row)

    # Write to new CSV file
    if transformed_data:
        fieldnames = ['Account Id', 'Account Name', 'Asset Id', 'Claimable Amount']

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(transformed_data)

        print(f"Transformed CSV file '{output_file}' created with {len(transformed_data)} rows.")
    else:
        print("No data to transform.")

if __name__ == "__main__":
    main()