# Subnet Bid Market Subgraph

This subgraph indexes events from the Subnet Bid Market contract on the blockchain. It tracks:

- Orders created in the marketplace
- Bids submitted by providers
- Order status changes (creation, cancellation, confirmation)
- Bid status changes (submission, acceptance, cancellation)

## Entities

- **Order**: Represents a request for compute resources in the marketplace
- **Bid**: Represents an offer from a provider to fulfill an order
- **OrderExtension**: Tracks when orders are extended with additional duration
- **OrderClosedEvent**: Records details about order closures including the reason

## Development

### Installation
```
yarn
```

### Generate Types
```
yarn codegen
```

### Build
```
yarn build
```

### Deploy
```
yarn deploy
```
