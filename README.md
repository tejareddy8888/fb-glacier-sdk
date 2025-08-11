# Midnight Drop Fireblocks SDK

A TypeScript SDK and REST API for managing Midnight protocol token claims and transfers through Fireblocks custody services. This SDK provides secure multi-blockchain support for claiming NIGHT tokens and managing transfers on the Cardano network.

## Features

- **Multi-Blockchain Support**: Claim tokens across Bitcoin, Ethereum, Cardano, BNB Chain, Solana, and Avalanche networks
- **Fireblocks Integration**: Enterprise-grade custody and transaction signing via Fireblocks
- **Token Claims Management**: Check eligibility and execute NIGHT token claims
- **Cardano Transfers**: Transfer NIGHT tokens between Cardano addresses
- **REST API**: Fully documented REST API with Swagger/OpenAPI support

## Prerequisites

- Node.js 20 or higher
- Fireblocks account with API credentials
- Blockfrost project ID (for Cardano token transfers)
- Docker and Docker Compose (for containerized deployment)

## Installation

### Clone the Repository

```bash
git clone https://github.com/fireblocks/midnight-glacier-drop-sdk.git
cd midnight-glacier-drop-sdk
```

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=8000

# Fireblocks Configuration
FIREBLOCKS_API_KEY=your_fireblocks_api_key
FIREBLOCKS_SECRET_KEY_PATH=./secrets/fireblocks_secret.key
BASE_PATH=https://api.fireblocks.io 

# Blockfrost Configuration (for Cardano tokens transfers)
BLOCKFROST_PROJECT_ID=your_blockfrost_project_id
```

### Fireblocks Secret Key Setup

Place your Fireblocks private key file in the `secrets` directory:

```bash
mkdir -p secrets
# Copy your fireblocks_secret.key to ./secrets/fireblocks_secret.key
```

## Local Development

### TypeScript/JavaScript Usage

#### 1. Direct SDK Usage in TypeScript

```typescript
import { FireblocksMidnightSDK } from './src/FireblocksMidnightSDK';
import { SupportedBlockchains } from './src/types';

// Create SDK instance using the static create method
// The SDK will automatically initialize all required services internally
async function initializeSdk(vaultAccountId: string, chain: SupportedBlockchains) {
  const sdk = await FireblocksMidnightSDK.create({
    vaultAccountId,
    chain
  });
  return sdk;
}

// Example: Check eligibility for claims
async function checkEligibility() {
  const vaultAccountId = 'your-vault-id';
  const chain = SupportedBlockchains.CARDANO;
  
  // Initialize SDK for this vault and chain
  const sdk = await initializeSdk(vaultAccountId, chain);
  
  // Check if address exists in Provetree (returns amount if eligible)
  const amount = await sdk.checkAddress(chain);
  const isEligible = amount > 0;
  
  console.log(`Vault ${vaultAccountId} eligibility: ${isEligible}`);
  console.log(`Claimable amount: ${amount}`);
}

// Example: Get historical claims (hitorical)
async function getAvailableClaims() {
  const vaultAccountId = 'your-vault-id';
  const chain = SupportedBlockchains.ETHEREUM;
  
  // Initialize SDK for this vault and chain
  const sdk = await initializeSdk(vaultAccountId, chain);
  
  // Get claims from the claims API
  const claims = await sdk.getClaims(chain);
  console.log('Available claims:', claims);
}

// Example: Execute claims
async function executeClaims() {
  const vaultAccountId = 'your-vault-id';
  const chain = SupportedBlockchains.CARDANO;
  const destinationAddress = 'addr1_destination_address'; // Where to send claimed tokens
  
  try {
    // Initialize SDK for this vault and chain
    const sdk = await initializeSdk(vaultAccountId, chain);
    
    // Make claims to the specified destination address
    const result = await sdk.makeClaims(chain, destinationAddress);
    console.log('Claims executed successfully:', result);
  } catch (error) {
    console.error('Claim execution failed:', error);
  }
}

// Example: Transfer NIGHT tokens on Cardano
async function transferNightTokens() {
  const fromVaultId = 'source-vault-id';
  const recipientAddress = 'addr1_destination_address';
  const tokenPolicyId = 'your_token_policy_id'; // NIGHT token policy ID
  const tokenAmount = 1000; // Amount of NIGHT tokens to transfer
  
  try {
    // Initialize SDK for Cardano
    const sdk = await initializeSdk(fromVaultId, SupportedBlockchains.CARDANO);
    
    // Transfer claims/tokens to recipient
    const result = await sdk.transferClaims(
      recipientAddress,
      tokenPolicyId,
      tokenAmount
    );
    console.log('Transfer successful:', result);
    console.log('Transaction hash:', result.txHash);
  } catch (error) {
    console.error('Transfer failed:', error);
  }
}

// Run examples
checkEligibility().catch(console.error);
getAvailableClaims().catch(console.error);
executeClaims().catch(console.error);
transferNightTokens().catch(console.error);
```

#### 2. Using the SDK Pool Manager

```typescript
import { SdkManager } from './src/pool/sdkManager';
import { SupportedBlockchains } from './src/types';

// Initialize SDK pool manager
const sdkManager = new SdkManager({
  maxPoolSize: 100,            // Maximum number of SDK instances
  idleTimeoutMs: 1800000,      // 30 minutes idle timeout
  cleanupIntervalMs: 300000,   // 5 minutes cleanup interval
  connectionTimeoutMs: 30000,  // 30 seconds connection timeout
  retryAttempts: 3             // Number of retry attempts
});

// Get SDK instance from pool
async function performOperationsWithPool() {
  const vaultAccountId = 'your-vault-id';
  const chain = SupportedBlockchains.ETHEREUM;
  
  // Get or create SDK instance for vault and chain
  // The pool automatically manages instance lifecycle
  const sdk = await sdkManager.getSdk(vaultAccountId, chain);
  
  // Perform operations
  const claims = await sdk.getClaims(chain);
  console.log('Claims:', claims);
  
  // SDK instance is automatically returned to pool after use
  // and can be reused for subsequent requests
}

// Cleanup on shutdown
process.on('SIGTERM', () => {
  sdkManager.cleanup();
  process.exit(0);
});
```

### Running the Development Server

```bash
# Development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run production server
npm start

# Generate documentation
npm run docs

# Run linter
npm run lint
```

## Docker Deployment

### Build and Run with Docker

```bash
# Build Docker image
docker build -t midnight-glacier-drop-sdk .

# Run container
docker run -d \
  --name midnight-glacier-drop-sdk \
  -p 8000:8000 \
  -v $(pwd)/secrets:/app/secrets:ro \
  -v $(pwd)/.env:/app/.env:ro \
  midnight-glacier-drop-sdk
```

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The `docker-compose.yml` configuration:
- Mounts the Fireblocks secret key from `./secrets`
- Loads environment variables from `.env`
- Exposes the API on port 8000
- Includes automatic restart on failure

## REST API Usage

The SDK provides a REST API accessible at `http://localhost:8000`. Full API documentation is available at `http://localhost:8000/api-docs`.

### API Endpoints

#### 1. Check Address in Provetree
```bash
# Check if an address is eligible for claims
curl -X GET "http://localhost:8000/api/provetree/check/CARDANO/vault-123"
```

Response:
```json
{
  "exists": true,
  "address": "addr1_example_address"
}
```

#### 2. Get Available Claims
```bash
# Get all available claims for a vault
curl -X GET "http://localhost:8000/api/claim/claims/ETHEREUM/vault-123"
```

Response:
```json
{
  "claims": [
    {
      "amount": "1000000000",
      "claimId": "claim-id-123",
      "status": "available"
    }
  ]
}
```

#### 3. Execute Claims
```bash
# Execute claims for a specific chain
curl -X POST "http://localhost:8000/api/claim/claims/CARDANO" \
  -H "Content-Type: application/json" \
  -d '{
    "vaultAccountId": "vault-123"
  }'
```

Response:
```json
{
  "success": true,
  "transactionHash": "tx_hash_123",
  "claimedAmount": "1000000000"
}
```

#### 4. Transfer NIGHT Tokens
```bash
# Transfer NIGHT tokens between addresses
curl -X POST "http://localhost:8000/api/claim/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "fromVaultId": "vault-123",
    "toAddress": "addr1_destination_address",
    "amount": "1000000000"
  }'
```

Response:
```json
{
  "success": true,
  "transactionHash": "tx_hash_456"
}
```

#### 5. Get Fireblocks Vault Addresses
```bash
# Get deposit addresses for a vault
curl -X GET "http://localhost:8000/api/fireblocks/vaults/BITCOIN/vault-123"
```

Response:
```json
{
  "vaultAccountId": "vault-123",
  "chain": "BITCOIN",
  "address": "bc1q_example_address"
}
```

#### 6. Health Check
```bash
# Check service health
curl -X GET "http://localhost:8000/api/health"
```

Response:
```json
{
  "status": "healthy",
  "uptime": 12345,
  "version": "1.0.0"
}
```

### Supported Blockchains

The SDK supports the following blockchain networks:

| Chain | Network | Token | Fireblocks Asset ID |
|-------|---------|-------|---------------------|
| BITCOIN | Mainnet/Testnet | BTC | BTC / BTC_TEST |
| ETHEREUM | Mainnet/Goerli | ETH | ETH / ETH_TEST3 |
| CARDANO | Mainnet/Preprod | ADA/NIGHT | ADA / ADA_TEST |
| BNB | BNB Smart Chain | BNB | BNB_BSC |
| SOLANA | Mainnet/Devnet | SOL | SOL / SOL_TEST |
| AVALANCHE | C-Chain | AVAX | AVAX |
| XRP | XRP Ledger | XRP | XRP / XRP_TEST |
| BAT | Basic Attention | BAT | BAT_TEST |


## API Documentation

### Swagger Documentation

Access the interactive API documentation at:
- Swagger UI: `http://localhost:8000/api-docs`
- OpenAPI JSON: `http://localhost:8000/api-docs-json`

### TypeDoc Documentation

Generate and view TypeScript documentation:

```bash
# Generate documentation
npm run docs

# Open docs/index.html in your browser
open docs/index.html
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [Midnight Protocol](https://midnight.network)
- [Fireblocks Documentation](https://developers.fireblocks.com)
- [Blockfrost Documentation](https://docs.blockfrost.io)
- [API Documentation](http://localhost:8000/api-docs)
