// Copyright 2025 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
"use strict";

/**
 * Tether WDK Indexer HTTP Client - Usage Examples
 *
 * This file demonstrates how to use the SDK to interact with the API.
 * Make sure to replace 'your-api-key' with your actual API key.
 */

import {
  WdkIndexerClient,
  WdkIndexerApiError,
  WdkIndexerTimeoutError,
  WdkIndexerNetworkError,
  isTokenTransfersResponse,
  isTokenBalanceResponse,
  BLOCKCHAINS,
} from "../index.js";

// Initialize the client
const client = new WdkIndexerClient({
  apiKey: process.env.WDK_INDEXER_API_KEY || "your-api-key",
  // Optional: custom timeout (default: 30000ms)
  timeout: 60000,
});

/**
 * Example 1: Health Check
 */
async function checkHealth() {
  console.log("=== Health Check ===");
  try {
    const health = await client.health();
    console.log(`API Status: ${health.status}`);
    console.log(`Timestamp: ${health.timestamp}`);
  } catch (error) {
    console.error("Health check failed:", error);
  }
}

/**
 * Example 2: Get Token Balance
 */
async function getBalance() {
  console.log("\n=== Get Token Balance ===");
  try {
    const balance = await client.getTokenBalance(
      "ethereum",
      "usdt",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7" // USDT contract address as example
    );

    console.log(`Blockchain: ${balance.tokenBalance.blockchain}`);
    console.log(`Token: ${balance.tokenBalance.token}`);
    console.log(`Balance: ${balance.tokenBalance.amount}`);
  } catch (error) {
    handleError(error);
  }
}

/**
 * Example 3: Get Token Transfers with Filters
 */
async function getTransfers() {
  console.log("\n=== Get Token Transfers ===");
  try {
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    const result = await client.getTokenTransfers(
      "ethereum",
      "usdt",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      {
        limit: 10,
        fromTs: oneWeekAgo,
      }
    );

    console.log(`Found ${result.transfers.length} transfers`);

    for (const transfer of result.transfers) {
      const date = new Date(transfer.timestamp * 1000).toISOString();
      console.log(
        `  ${date}: ${transfer.amount} from ${transfer.from} to ${transfer.to}`
      );
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Example 4: Batch Token Balances
 */
async function getBatchBalances() {
  console.log("\n=== Batch Token Balances ===");
  try {
    const address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

    // Get USDT balance across multiple chains
    const requests = ["ethereum", "polygon", "arbitrum"].map((blockchain) => ({
      blockchain,
      token: "usdt",
      address,
    }));

    const results = await client.getBatchTokenBalances(requests);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chain = requests[i]?.blockchain;

      if (isTokenBalanceResponse(result)) {
        console.log(`  ${chain}: ${result.tokenBalance.amount} USDT`);
      } else {
        console.log(`  ${chain}: Error - ${result.message}`);
      }
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Example 5: Batch Token Transfers
 */
async function getBatchTransfers() {
  console.log("\n=== Batch Token Transfers ===");
  try {
    const results = await client.getBatchTokenTransfers([
      {
        blockchain: "ethereum",
        token: "usdt",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        limit: 5,
      },
      {
        blockchain: "tron",
        token: "usdt",
        address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT contract on Tron
        limit: 5,
      },
    ]);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chain = i === 0 ? "Ethereum" : "Tron";

      if (isTokenTransfersResponse(result)) {
        console.log(`  ${chain}: ${result.transfers.length} transfers found`);
      } else {
        console.log(`  ${chain}: Error - ${result.message}`);
      }
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Example 6: Track Total USDT Holdings Across All Chains
 */
async function trackTotalHoldings(address) {
  console.log("\n=== Total USDT Holdings Across All Chains ===");
  console.log(`Address: ${address}`);

  try {
    const requests = BLOCKCHAINS.map((blockchain) => ({
      blockchain,
      token: "usdt",
      address,
    }));

    const results = await client.getBatchTokenBalances(requests);

    let total = BigInt(0);
    const balances = {};

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chain = BLOCKCHAINS[i];

      if (chain && isTokenBalanceResponse(result)) {
        const amount = BigInt(result.tokenBalance.amount);
        if (amount > 0) {
          balances[chain] = result.tokenBalance.amount;
          total += amount;
        }
      }
    }

    console.log("\nBalances by chain:");
    for (const [chain, amount] of Object.entries(balances)) {
      console.log(`  ${chain}: ${amount}`);
    }
    console.log(`\nTotal: ${total.toString()}`);
  } catch (error) {
    handleError(error);
  }
}

/**
 * Error handler helper
 */
function handleError(error) {
  if (error instanceof WdkIndexerApiError) {
    console.error(
      `API Error [${error.status}]: ${error.errorType} - ${error.message}`
    );
  } else if (error instanceof WdkIndexerTimeoutError) {
    console.error(`Timeout: ${error.message}`);
  } else if (error instanceof WdkIndexerNetworkError) {
    console.error(`Network Error: ${error.message}`);
  } else {
    console.error("Unknown error:", error);
  }
}

/**
 * Run all examples
 */
async function main() {
  console.log("Tether WDK Indexer HTTP Client Examples\n");
  console.log(
    "Note: Set WDK_INDEXER_API_KEY environment variable to run these examples.\n"
  );

  await checkHealth();
  await getBalance();
  await getTransfers();
  await getBatchBalances();
  await getBatchTransfers();
  await trackTotalHoldings("0x742d35Cc6634C0532925a3b844Bc9e7595f5aB12");
}

main().catch(console.error);
