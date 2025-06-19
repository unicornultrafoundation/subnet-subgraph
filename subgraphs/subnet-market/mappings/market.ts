import { BigInt, json } from '@graphprotocol/graph-ts'
import {
  OrderCreated,
  BidSubmitted,
  BidAccepted,
  BidCancelled,
  OrderClosed,
  OrderExtended,
  OrderCancelled,
  Market
} from '../generated/Market/Market'
import { Order, Bid, OrderExtension, OrderClosedEvent, MarketStat } from '../generated/schema'


function updateOrderMetadata(order: Order, metadata: string) : void{
  let jsonData = json.try_fromString(metadata)

  if (jsonData.isOk) {
    let parsedMetadata = jsonData.value.toObject();

    let name = parsedMetadata.get("name");
    if (name && !name.isNull()) {
      order.name = name.toString();
    }
  }
}

export function handleOrderCreated(event: OrderCreated): void {
  let order = new Order(event.params.orderId.toString())

  // Get the bid details from the contract
  let marketContract = Market.bind(event.address)
  let bOrder = marketContract.orders(event.params.orderId)
  
  
  order.owner = event.params.owner
  order.duration = event.params.duration
  order.machineType = bOrder.getMachineType() // Default value as it's not in event
  order.status = "Created"
  order.name = "Order-" + event.params.orderId.toString()
  order.createdAt = event.block.timestamp
  order.minBidPrice = bOrder.getMinBidPrice() // These will need to be set from contract call
  order.maxBidPrice = bOrder.getMaxBidPrice()
  order.region = bOrder.getRegion()
  order.cpuCores = bOrder.getCpuCores()
  order.gpuCores = bOrder.getGpuCores()
  order.gpuMemory = bOrder.getGpuMemory()
  order.memoryMB = bOrder.getMemoryMB()
  order.diskGB = bOrder.getDiskGB()
  order.uploadMbps =bOrder.getUploadMbps()
  order.downloadMbps = bOrder.getDownloadMbps()
  order.specs = bOrder.getSpecs()
  order.transactionHash = event.transaction.hash
  updateOrderMetadata( order, bOrder.getSpecs())

  order.save()
  
  // Update market stats
  let marketStat = MarketStat.load("singleton")
  if (marketStat == null) {
    marketStat = new MarketStat("singleton")
    marketStat.totalOrders = BigInt.fromI32(0)
    marketStat.totalActiveBids = BigInt.fromI32(0)
    marketStat.totalAcceptedBids = BigInt.fromI32(0)
  }
  
  marketStat.totalOrders = marketStat.totalOrders.plus(BigInt.fromI32(1))
  marketStat.lastUpdated = event.block.timestamp
  marketStat.save()
}

export function handleOrderCancelled(event: OrderCancelled): void {
  let order = Order.load(event.params.orderId.toString())
  
  if (order) {
    order.status = "Cancelled"
    order.save()
  }
}


export function handleBidSubmitted(event: BidSubmitted): void {
  let bidId = event.params.orderId.toString() + "-" + event.params.bidIndex.toString()
  let bid = new Bid(bidId)
  
  // Get the bid details from the contract
  let marketContract = Market.bind(event.address)
  let orderBid = marketContract.orderBids(event.params.orderId, event.params.bidIndex)
  
  // Find the bid with matching bidIndex (which is the same as the array index)
  if (orderBid) {
    bid.order = event.params.orderId.toString()
    bid.owner = orderBid.getProvider()
    bid.pricePerSecond = orderBid.getPricePerSecond()
    bid.status = "Submitted"
    bid.createdAt = event.block.timestamp
    bid.provider = event.params.providerId.toString()
    const machineEntityId = event.params.providerId.toString() + "-" + event.params.machineId.toString();

    bid.machine = machineEntityId
    bid.bidIndex = event.params.bidIndex
    bid.transactionHash = event.transaction.hash
    
    bid.save()
    
    // Update market stats
    let marketStat = MarketStat.load("singleton")
    if (marketStat == null) {
      marketStat = new MarketStat("singleton")
      marketStat.totalOrders = BigInt.fromI32(0)
      marketStat.totalActiveBids = BigInt.fromI32(0)
      marketStat.totalAcceptedBids = BigInt.fromI32(0)
    }
    
    marketStat.totalActiveBids = marketStat.totalActiveBids.plus(BigInt.fromI32(1))
    marketStat.lastUpdated = event.block.timestamp
    marketStat.save()
  }
}

export function handleBidAccepted(event: BidAccepted): void {
  let bidId = event.params.orderId.toString() + "-" + event.params.bidIndex.toString()
  let bid = Bid.load(bidId)
  
  if (bid) {
    bid.status = "Accepted"
    bid.pricePerSecond = event.params.pricePerSecond
    bid.save()
    
    let order = Order.load(event.params.orderId.toString())
    if (order) {
      order.status = "Accepted"
      order.acceptedBidPrice = event.params.pricePerSecond
      order.acceptedProvider = event.params.providerId.toString()
      const machineEntityId = event.params.providerId.toString() + "-" + event.params.machineId.toString();

      order.acceptedMachine = machineEntityId
      order.save()
    }
    
    // Update market stats
    let marketStat = MarketStat.load("singleton")
    if (marketStat) {
      marketStat.totalAcceptedBids = marketStat.totalAcceptedBids.plus(BigInt.fromI32(1))
      marketStat.totalActiveBids = marketStat.totalActiveBids.minus(BigInt.fromI32(1))
      marketStat.lastUpdated = event.block.timestamp
      marketStat.save()
    }
  }
}

export function handleBidCancelled(event: BidCancelled): void {
  let bidId = event.params.orderId.toString() + "-" + event.params.bidIndex.toString()
  let bid = Bid.load(bidId)
  
  if (bid) {
    bid.status = "Cancelled"
    bid.save()
    
    // Update market stats
    let marketStat = MarketStat.load("singleton")
    if (marketStat) {
      marketStat.totalActiveBids = marketStat.totalActiveBids.minus(BigInt.fromI32(1))
      marketStat.lastUpdated = event.block.timestamp
      marketStat.save()
    }
  }
}

export function handleOrderClosed(event: OrderClosed): void {
  let order = Order.load(event.params.orderId.toString())
  
  if (order) {
    order.status = "Closed"
    order.save()
    
    let closedEvent = new OrderClosedEvent(event.transaction.hash.toHexString() + "-" + event.logIndex.toString())
    closedEvent.order = event.params.orderId.toString()
    closedEvent.refundAmount = event.params.refundAmount
    closedEvent.reason = event.params.reason
    closedEvent.timestamp = event.block.timestamp
    closedEvent.transactionHash = event.transaction.hash
    closedEvent.save()
  }
}

export function handleOrderExtended(event: OrderExtended): void {
  let order = Order.load(event.params.orderId.toString())
  
  if (order) {
    order.expiredAt = event.params.newExpiry
    order.save()
    
    let extension = new OrderExtension(event.transaction.hash.toHexString() + "-" + event.logIndex.toString())
    extension.order = event.params.orderId.toString()
    extension.additionalDuration = event.params.additionalDuration
    extension.newExpiry = event.params.newExpiry
    extension.timestamp = event.block.timestamp
    extension.transactionHash = event.transaction.hash
    extension.save()
  }
}
