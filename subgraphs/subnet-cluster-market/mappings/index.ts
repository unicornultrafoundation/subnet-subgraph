import { OrderCanceled, OrderCreated, OrderConfirmed, ClusterNodeRemoved, ClusterNodesAdded } from "../generated/SubnetClusterMarket/SubnetClusterMarket"
import { Order, User, Cluster } from "../generated/schema"
import { SubnetClusterMarket } from "../generated/SubnetClusterMarket/SubnetClusterMarket"
import { Address, BigInt } from "@graphprotocol/graph-ts"

// Enum for order status
enum OrderStatus {
  Pending, 
  Confirmed, 
  Canceled, 
  Refunded
}

// Enum for order type
enum OrderType {
  New,
  Renew,
  Upgrade
}

// Handle OrderCreated event
export function handleOrderCreated(event: OrderCreated): void {
  let userId = event.params.user.toHex()
  let user = User.load(userId)
  if (!user) {
    user = new User(userId)
    user.address = userId
    user.save()
  }

  let orderId = event.params.orderId.toString()
  let contract = SubnetClusterMarket.bind(event.address)
  let orderCall = contract.orders(event.params.orderId)

  let order = new Order(orderId)
  order.user = user.id
  order.status = orderCall.getStatus() // status as int
  order.ip = orderCall.getIp()
  order.gpu = orderCall.getGpu()
  order.cpu = orderCall.getCpu()
  order.memoryBytes = orderCall.getMemoryBytes()
  order.disk = orderCall.getDisk()
  order.network = orderCall.getNetwork()
  order.rentalDuration = orderCall.getRentalDuration()
  order.paymentToken = orderCall.getPaymentToken().toHexString()
  order.cluster = orderCall.getClusterId().toHexString()
  order.paidAmount = orderCall.getPaidAmount()
  order.discountAmount = orderCall.getDiscountAmount()
  order.orderType = orderCall.getOrderType() // order type as int
  order.createdAt = event.block.timestamp
  order.save()
}

// Handle OrderCanceled event
export function handleOrderCancelled(event: OrderCanceled): void {
  let orderId = event.params.orderId.toString()
  let order = Order.load(orderId)
  if (order) {
    order.status = OrderStatus.Canceled
    order.canceledAt = event.block.timestamp
    order.save()
  }
}

// Create or update Cluster entity from Order (for New order)
function createOrUpdateClusterFromOrder(order: Order, eventAddress: Address, orderId: BigInt): void {
  let contract = SubnetClusterMarket.bind(eventAddress)
  let orderCall = contract.orders(orderId)
  let clusterId = orderCall.getClusterId()
  let clusterCall = contract.getCluster(clusterId)
  let clusterEntityId = clusterId.toString()
  let cluster = new Cluster(clusterEntityId)
  cluster.nodeIps = clusterCall.nodeIps
  cluster.active = clusterCall.active
  cluster.expiration = clusterCall.expiration
  cluster.renter = order.user
  cluster.ip = clusterCall.ip
  cluster.gpu = clusterCall.gpu
  cluster.cpu = clusterCall.cpu
  cluster.memoryBytes = clusterCall.memoryBytes
  cluster.disk = clusterCall.disk
  cluster.network = clusterCall.network
  cluster.save()
  order.cluster = clusterEntityId
}

// Extend cluster expiration for Renew order
function renewCluster(order: Order): void {
  if (order.cluster !== null) {
    let cluster = Cluster.load(order.cluster as string)
    if (cluster) {
      cluster.expiration = cluster.expiration.plus(order.rentalDuration)
      cluster.save()
    }
  }
}

// Increase cluster resources for Upgrade order
function upgradeCluster(order: Order): void {
  if (order.cluster !== null) {
    let cluster = Cluster.load(order.cluster as string)
    if (cluster) {
      cluster.gpu = cluster.gpu.plus(order.gpu)
      cluster.cpu = cluster.cpu.plus(order.cpu)
      cluster.memoryBytes = cluster.memoryBytes.plus(order.memoryBytes)
      cluster.disk = cluster.disk.plus(order.disk)
      cluster.network = cluster.network.plus(order.network)
      cluster.save()
    }
  }
}

// Handle OrderConfirmed event
export function handleOrderConfirmed(event: OrderConfirmed): void {
  let orderId = event.params.orderId.toString()
  let order = Order.load(orderId)
  if (order) {
    order.status = OrderStatus.Confirmed
    order.confirmedAt = event.block.timestamp

    // If order type is New, create or update cluster
    if (order.orderType == OrderType.New) {
      createOrUpdateClusterFromOrder(order, event.address, event.params.orderId)
    } 
    // If order type is Renew, extend cluster expiration
    else if (order.orderType == OrderType.Renew) {
      renewCluster(order)
    } 
    // If order type is Upgrade, increase cluster resources
    else if (order.orderType == OrderType.Upgrade) {
      upgradeCluster(order)
    }

    order.save();
  }
}

// Handle ClusterNodeRemoved event: remove nodeIp from cluster.nodeIps
export function handleClusterNodeRemoved(event: ClusterNodeRemoved): void {
  let clusterId = event.params.clusterId.toString()
  let nodeIp = event.params.nodeIp

  let cluster = Cluster.load(clusterId)
  if (cluster && cluster.nodeIps) {
    let ips = cluster.nodeIps as BigInt[]
    let filteredIps = new Array<BigInt>()
    for (let i = 0; i < ips.length; i++) {
      if (!ips[i].equals(nodeIp)) {
        filteredIps.push(ips[i])
      }
    }
    cluster.nodeIps = filteredIps
    cluster.save()
  }
}

// Handle ClusterNodesAdded event: add new nodeIps to cluster.nodeIps
export function handleClusterNodesAdded(event: ClusterNodesAdded): void {
  let clusterId = event.params.clusterId.toString()
  let cluster = Cluster.load(clusterId)
  if (cluster) {
    let currentIps = cluster.nodeIps as BigInt[]
    let newIps = event.params.newNodeIps
    for (let i = 0; i < newIps.length; i++) {
      if (!currentIps.includes(newIps[i])) {
        currentIps.push(newIps[i])
      }
    }
    cluster.nodeIps = currentIps
    cluster.save()
  }
}