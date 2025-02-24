import { ProviderRegistered, ProviderUpdated, ProviderDeleted, Transfer, PeerNodeRegistered } from "../generated/SubnetProvider/SubnetProvider"
import { Provider, Owner, PeerNode } from "../generated/schema"

export function handleProviderRegistered(event: ProviderRegistered): void {
  let provider = new Provider(event.params.tokenId.toHex())
  provider.providerName = event.params.providerName
  provider.metadata = event.params.metadata
  provider.operator = event.params.operator
  provider.website = event.params.website
  provider.deleted = false // Initialize the deleted field

  let owner = Owner.load(event.params.providerAddress.toHex())
  if (owner == null) {
    owner = new Owner(event.params.providerAddress.toHex())
    owner.address = event.params.providerAddress
  }
  provider.owner = owner.id
  provider.save()
  owner.save()
}

export function handleProviderUpdated(event: ProviderUpdated): void {
  let provider = Provider.load(event.params.tokenId.toHex())
  if (provider != null) {
    provider.providerName = event.params.providerName
    provider.metadata = event.params.metadata
    provider.operator = event.params.operator
    provider.website = event.params.website
    provider.save()
  }
}

export function handleProviderDeleted(event: ProviderDeleted): void {
  let provider = Provider.load(event.params.tokenId.toHex())
  if (provider != null) {
    provider.deleted = true // Mark the provider as deleted
    provider.save()
  }
}

export function handleTransfer(event: Transfer): void {
  let provider = Provider.load(event.params.tokenId.toHex())
  if (provider != null) {
    let newOwner = Owner.load(event.params.to.toHex())
    if (newOwner == null) {
      newOwner = new Owner(event.params.to.toHex())
      newOwner.address = event.params.to
    }
    provider.owner = newOwner.id
    provider.save()
    newOwner.save()
  }
}

export function handlePeerNodeRegistered(event: PeerNodeRegistered): void {
  let peerNodeId = event.params.tokenId.toHex() + "-" + event.params.peerId
  let peerNode = new PeerNode(peerNodeId)
  peerNode.peerId = event.params.peerId
  peerNode.metadata = event.params.metadata

  let provider = Provider.load(event.params.tokenId.toHex())
  if (provider != null) {
    peerNode.provider = provider.id
    peerNode.save()
  }
}
