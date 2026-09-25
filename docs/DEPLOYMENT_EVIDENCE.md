# Midnight Preprod deployment evidence

Verified against Midnight Preprod indexer on 2026-09-25.

| Field | Value |
|---|---|
| Network | `preprod` |
| Contract address | `e08ec0611dc2a4eefde094303cab14e9c18c4473d1f2c8269fa2b2bfa944f44a` |
| Deployment transaction hash | `6692a2dcc8ac700a2d961e667dcb3a6bf67a3fe4acba4b2845c247be696344bc` |
| Ledger transaction IDs | `0099a53f0210904f8279aa5cc7c7727a2ae02dadca3c50944c66fe7d3a13c86816`, `0053efcbc762614ae5aadfa07df0393036bf7ed3719c6918ab851bc4a8ba9777b5` |
| Block height | `2647471` |
| Block hash | `be792078eed1c353168d0453f3c5e7555da526c64edea3f8712c94584cde22cf` |
| Block timestamp | `2026-09-21T13:31:24Z` |

- [Verify transaction in Midnight Preprod Explorer](https://preprod.midnightexplorer.com/transactions/6692a2dcc8ac700a2d961e667dcb3a6bf67a3fe4acba4b2845c247be696344bc)
- [Verify contract in Midnight Preprod Explorer](https://preprod.midnightexplorer.com/contracts/e08ec0611dc2a4eefde094303cab14e9c18c4473d1f2c8269fa2b2bfa944f44a)

## Independent indexer check

```bash
curl -fsS 'https://indexer.preprod.midnight.network/api/v4/graphql' \
  -H 'content-type: application/json' \
  --data-binary '{"query":"query($address: HexEncoded!) { contractAction(address: $address) { address transaction { hash block { height hash timestamp } } } }","variables":{"address":"e08ec0611dc2a4eefde094303cab14e9c18c4473d1f2c8269fa2b2bfa944f44a"}}'
```

Expected indexed identity:

```json
{
  "address": "e08ec0611dc2a4eefde094303cab14e9c18c4473d1f2c8269fa2b2bfa944f44a",
  "transaction": {
    "hash": "6692a2dcc8ac700a2d961e667dcb3a6bf67a3fe4acba4b2845c247be696344bc",
    "block": {
      "height": 2647471,
      "hash": "be792078eed1c353168d0453f3c5e7555da526c64edea3f8712c94584cde22cf",
      "timestamp": 1789997484000
    }
  }
}
```

Querying contract state before block `2647471` returns `null`, while block `2647471` contains this contract action. This identifies transaction above as deployment action, not later call.

Ledger transaction IDs above come from deserializing indexer `transaction.raw` with `@midnight-ntwrk/ledger-v8` and calling `identifiers()`. Transaction hash independently matches `transactionHash()` and indexer value. They are genuine ledger identifiers—not prefixes or hashes of serialized bytes.

Runtime deployment flow also returns finalized ledger transaction ID, transaction hash, block hash, and block height from `deployContract()`. UI exposes those values after wallet approval.
