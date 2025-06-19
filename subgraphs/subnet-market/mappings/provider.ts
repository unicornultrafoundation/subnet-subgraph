import {
  BigInt,
  Address,
  ethereum,
  dataSource,
  log,
  json,
  JSONValue,
} from "@graphprotocol/graph-ts";
import {
  Provider as ProviderContract,
  ProviderUpdated,
  ProviderVerified,
  ProviderReputationUpdated,
  MachineAdded,
  MachineRemoved,
  MachineUpdated,
  MachineResourcePriceUpdated,
  StakeSlashed,
  StakeWithdrawn,
  Transfer,
} from "../generated/Provider/Provider";
import {
  Provider,
  Machine,
  StakeTransaction,
  ProviderDailySnapshot,
  GlobalStats,
} from "../generated/schema";

export function handleTransfer(event: Transfer): void {
  const providerContract = ProviderContract.bind(event.address);

  // Check if the event is a mint event
  if (event.params.from.equals(Address.zero())) {
    // This is a mint event, create a new provider
    let bProvider = providerContract.getProvider(event.params.tokenId);
    if (bProvider) {
      const providerId = event.params.tokenId.toString();
      let newProvider = new Provider(providerId);
      newProvider.operator = bProvider.operator;
      newProvider.owner = event.params.to;
      newProvider.tokenId = bProvider.tokenId;
      newProvider.metadata = bProvider.metadata;
      newProvider.registered = true;
      newProvider.reputation = BigInt.fromI32(0);
      newProvider.machineCount = BigInt.fromI32(0);
      newProvider.createdAt = event.block.timestamp;
      newProvider.totalStaked = BigInt.fromI32(0);
      newProvider.pendingWithdrawals = BigInt.fromI32(0);
      newProvider.slashedAmount = BigInt.fromI32(0);
      newProvider.isSlashed = false;
      newProvider.isActive = true;
      newProvider.verified = false;
      newProvider.name = "";
      newProvider.description = "";
      newProvider.updatedAt = event.block.timestamp;
      updateProviderMetadata(newProvider, bProvider.metadata);
      newProvider.save();
    }
  }
}

function updateProviderMetadata(provider: Provider, metadata: string): void {
  let jsonData = json.try_fromString(metadata)

  if (jsonData.isOk) {
    let parsedMetadata = jsonData.value.toObject();

    let name = parsedMetadata.get("name");
    if (name && !name.isNull()) {
      provider.name = name.toString();
    }

    let description = parsedMetadata.get("description");
    if (description && !description.isNull()) {
      provider.description = description.toString();
    }
  }
}

export function handleProviderUpdated(event: ProviderUpdated): void {
  const providerId = event.params.providerId.toString();
  let provider = Provider.load(providerId);
  if (provider) {
    const providerContract = ProviderContract.bind(dataSource.address());
    const providerData = providerContract.getProvider(event.params.providerId);

    provider.operator = providerData.operator;
    provider.owner = providerContract.ownerOf(providerData.tokenId);
    provider.tokenId = providerData.tokenId;
    provider.metadata = providerData.metadata;

    updateProviderMetadata(provider, providerData.metadata);
    provider.updatedAt = event.block.timestamp;
    provider.save();

    updateGlobalStats(event.block.timestamp);
    createProviderDailySnapshot(provider, event.block.timestamp);
  }
}

export function handleProviderVerified(event: ProviderVerified): void {
  const providerId = event.params.providerId.toString();
  let provider = Provider.load(providerId);

  if (!provider) {
    log.warning("Provider not found for verification: {}", [providerId]);
    return;
  }

  provider.verified = event.params.verified;
  provider.updatedAt = event.block.timestamp;
  provider.save();

  createProviderDailySnapshot(provider, event.block.timestamp);
}

export function handleProviderReputationUpdated(
  event: ProviderReputationUpdated,
): void {
  const providerId = event.params.providerId.toString();
  let provider = Provider.load(providerId);

  if (!provider) {
    log.warning("Provider not found for reputation update: {}", [providerId]);
    return;
  }

  provider.reputation = event.params.newReputation;
  provider.updatedAt = event.block.timestamp;
  provider.save();

  createProviderDailySnapshot(provider, event.block.timestamp);
  updateGlobalStats(event.block.timestamp);
}

function updateMachineMetadata(machine: Machine, metadata: string): void {
  let jsonData = json.try_fromString(metadata)
  if (jsonData.isOk) {
    let obj = jsonData.value.toObject();
    let name = obj.get("name");
    if (name && !name.isNull()) {
      machine.name = name.toString();
    }

    let description = obj.get("description");
    if (description && !description.isNull()) {
      machine.description = description.toString();
    }

    let host = obj.get("host");
    if (host && !host.isNull()) {
      machine.host = host.toString();
    }

    let publicIp = obj.get("public_ip");
    if (publicIp && !publicIp.isNull()) {
      machine.publicIp = publicIp.toString();
    }

    let overlayIp = obj.get("overlay_ip");
    if (overlayIp && !overlayIp.isNull()) {
      machine.overlayIp = overlayIp.toString();
    }

  }
}

export function handleMachineAdded(event: MachineAdded): void {
  const providerId = event.params.providerId.toString();
  const machineId = event.params.machineId;
  const machineEntityId = providerId + "-" + machineId.toString();

  let provider = Provider.load(providerId);
  if (!provider) {
    log.warning("Provider not found when adding machine: {}", [providerId]);
    return;
  }

  provider.machineCount = provider.machineCount.plus(BigInt.fromI32(1));
  provider.totalStaked = provider.totalStaked.plus(event.params.stakedAmount);
  provider.updatedAt = event.block.timestamp;
  provider.save();

  const providerContract = ProviderContract.bind(dataSource.address());
  const machineData = providerContract.providerMachines(
    event.params.providerId,
    machineId,
  );

  let machine = new Machine(machineEntityId);
  machine.machineId = machineId;
  machine.provider = providerId;
  machine.active = machineData.getActive();
  machine.machineType = machineData.getMachineType();
  machine.region = machineData.getRegion();
  machine.cpuCores = machineData.getCpuCores();
  machine.gpuCores = machineData.getGpuCores();
  machine.gpuMemory = machineData.getGpuMemory();
  machine.memoryMB = machineData.getMemoryMB();
  machine.diskGB = machineData.getDiskGB();
  machine.uploadSpeed = machineData.getUploadSpeed();
  machine.downloadSpeed = machineData.getDownloadSpeed();
  machine.createdAt = event.block.timestamp;
  machine.updatedAt = event.block.timestamp;
  machine.stakeAmount = event.params.stakedAmount;
  machine.withdrawalProcessed = false;
  machine.metadata = machineData.getMetadata();


  machine.cpuPricePerSecond = machineData.getCpuPricePerSecond();
  machine.gpuPricePerSecond = machineData.getGpuPricePerSecond();
  machine.memoryPricePerSecond = machineData.getMemoryPricePerSecond();
  machine.diskPricePerSecond = machineData.getDiskPricePerSecond();

  updateMachineMetadata(machine, machineData.getMetadata());

  machine.save();

  createStakeTransaction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    providerId,
    machineEntityId,
    event.params.stakedAmount,
    "ADDED",
    null,
    event.block.timestamp,
  );

  updateGlobalStats(event.block.timestamp);
  createProviderDailySnapshot(provider, event.block.timestamp);
}

export function handleMachineRemoved(event: MachineRemoved): void {
  const providerId = event.params.providerId.toString();
  const machineId = event.params.machineId;
  const machineEntityId = providerId + "-" + machineId.toString();

  let machine = Machine.load(machineEntityId);
  if (!machine) {
    log.warning("Machine not found for removal: {}", [machineEntityId]);
    return;
  }

  let provider = Provider.load(providerId);
  if (!provider) {
    log.warning("Provider not found when removing machine: {}", [providerId]);
    return;
  }

  machine.active = false;
  machine.removedAt = event.block.timestamp;
  machine.unlockTime = event.params.unlocktime;
  machine.updatedAt = event.block.timestamp;
  machine.save();

  provider.pendingWithdrawals = provider.pendingWithdrawals.plus(
    machine.stakeAmount,
  );
  provider.updatedAt = event.block.timestamp;
  provider.save();

  createProviderDailySnapshot(provider, event.block.timestamp);
  updateGlobalStats(event.block.timestamp);
}

export function handleMachineUpdated(event: MachineUpdated): void {
  const providerId = event.params.providerId.toString();
  const machineId = event.params.machineId;
  const machineEntityId = providerId + "-" + machineId.toString();

  let machine = Machine.load(machineEntityId);
  if (!machine) {
    log.warning("Machine not found for update: {}", [machineEntityId]);
    return;
  }

  let provider = Provider.load(providerId);
  if (!provider) {
    log.warning("Provider not found when updating machine: {}", [providerId]);
    return;
  }

  const providerContract = ProviderContract.bind(dataSource.address());
  const machineData = providerContract.providerMachines(
    event.params.providerId,
    machineId,
  );

  machine.cpuCores = machineData.getCpuCores();
  machine.gpuCores = machineData.getGpuCores();
  machine.gpuMemory = machineData.getGpuMemory();
  machine.memoryMB = machineData.getMemoryMB();
  machine.diskGB = machineData.getDiskGB();
  machine.uploadSpeed = machineData.getUploadSpeed();
  machine.downloadSpeed = machineData.getDownloadSpeed();
  machine.metadata = machineData.getMetadata();
  machine.cpuPricePerSecond = machineData.getCpuPricePerSecond();
  machine.gpuPricePerSecond = machineData.getGpuPricePerSecond();
  machine.memoryPricePerSecond = machineData.getMemoryPricePerSecond();
  machine.diskPricePerSecond = machineData.getDiskPricePerSecond();

  updateMachineMetadata(machine, machineData.getMetadata());

  machine.stakeAmount = machine.stakeAmount.plus(event.params.additionalStake);
  machine.updatedAt = event.block.timestamp;
  machine.save();

  provider.totalStaked = provider.totalStaked.plus(
    event.params.additionalStake,
  );
  provider.updatedAt = event.block.timestamp;
  provider.save();

  if (event.params.additionalStake.gt(BigInt.fromI32(0))) {
    createStakeTransaction(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
      providerId,
      machineEntityId,
      event.params.additionalStake,
      "ADDED",
      null,
      event.block.timestamp,
    );
  }

  createProviderDailySnapshot(provider, event.block.timestamp);
  updateGlobalStats(event.block.timestamp);
}

export function handleMachineResourcePriceUpdated(
  event: MachineResourcePriceUpdated,
): void {
  const providerId = event.params.providerId.toString();
  const machineId = event.params.machineId;
  const machineEntityId = providerId + "-" + machineId.toString();

  let machine = Machine.load(machineEntityId);
  if (!machine) {
    log.warning("Machine not found for price update: {}", [machineEntityId]);
    return;
  }

  machine.cpuPricePerSecond = event.params.cpuPricePerSecond;
  machine.gpuPricePerSecond = event.params.gpuPricePerSecond;
  machine.memoryPricePerSecond = event.params.memoryPricePerSecond;
  machine.diskPricePerSecond = event.params.diskPricePerSecond;
  machine.updatedAt = event.block.timestamp;
  machine.save();
}

export function handleStakeSlashed(event: StakeSlashed): void {
  const providerId = event.params.providerId.toString();
  const machineId = event.params.machineId;
  const machineEntityId = providerId + "-" + machineId.toString();

  let provider = Provider.load(providerId);
  if (!provider) {
    log.warning("Provider not found when slashing stake: {}", [providerId]);
    return;
  }

  let machine = Machine.load(machineEntityId);
  if (!machine) {
    log.warning("Machine not found for slashing: {}", [machineEntityId]);
    return;
  }

  provider.slashedAmount = provider.slashedAmount.plus(event.params.amount);
  provider.totalStaked = provider.totalStaked.minus(event.params.amount);
  provider.isSlashed = true;
  provider.updatedAt = event.block.timestamp;
  provider.save();

  machine.stakeAmount = machine.stakeAmount.minus(event.params.amount);
  machine.updatedAt = event.block.timestamp;
  machine.save();

  createStakeTransaction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    providerId,
    machineEntityId,
    event.params.amount,
    "SLASHED",
    event.params.reason,
    event.block.timestamp,
  );

  createProviderDailySnapshot(provider, event.block.timestamp);
  updateGlobalStats(event.block.timestamp);
}

export function handleStakeWithdrawn(event: StakeWithdrawn): void {
  const providerId = event.params.providerId.toString();
  const machineId = event.params.machineId;
  const machineEntityId = providerId + "-" + machineId.toString();

  let provider = Provider.load(providerId);
  if (!provider) {
    log.warning("Provider not found when withdrawing stake: {}", [providerId]);
    return;
  }

  let machine = Machine.load(machineEntityId);
  if (!machine) {
    log.warning("Machine not found for withdrawal: {}", [machineEntityId]);
    return;
  }

  machine.withdrawalProcessed = true;
  machine.updatedAt = event.block.timestamp;
  machine.save();

  provider.pendingWithdrawals = provider.pendingWithdrawals.minus(
    event.params.amount,
  );
  provider.updatedAt = event.block.timestamp;
  provider.save();

  createStakeTransaction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    providerId,
    machineEntityId,
    event.params.amount,
    "WITHDRAWN",
    null,
    event.block.timestamp,
  );

  createProviderDailySnapshot(provider, event.block.timestamp);
  updateGlobalStats(event.block.timestamp);
}

// Helper functions

function createStakeTransaction(
  id: string,
  providerId: string,
  machineId: string,
  amount: BigInt,
  transactionType: string,
  reason: string | null,
  timestamp: BigInt,
): void {
  let transaction = new StakeTransaction(id);
  transaction.provider = providerId;
  transaction.machine = machineId;
  transaction.amount = amount;
  transaction.transactionType = transactionType;
  transaction.reason = reason;
  transaction.timestamp = timestamp;
  transaction.save();
}

function createProviderDailySnapshot(
  provider: Provider,
  timestamp: BigInt,
): void {
  const dayId = timestamp.div(BigInt.fromI32(86400)).toString();
  const snapshotId = provider.id + "-" + dayId;

  let snapshot = ProviderDailySnapshot.load(snapshotId);
  if (!snapshot) {
    snapshot = new ProviderDailySnapshot(snapshotId);
    snapshot.provider = provider.id;
    snapshot.timestamp = timestamp;
    snapshot.date = formatDate(timestamp);
  }

  snapshot.machineCount = provider.machineCount;
  snapshot.totalStaked = provider.totalStaked;
  snapshot.slashedAmount = provider.slashedAmount;
  snapshot.reputation = provider.reputation;
  snapshot.save();
}

function updateGlobalStats(timestamp: BigInt): void {
  let stats = GlobalStats.load("1");
  if (!stats) {
    stats = new GlobalStats("1");
    stats.totalProviders = BigInt.fromI32(0);
    stats.totalMachines = BigInt.fromI32(0);
    stats.totalStaked = BigInt.fromI32(0);
    stats.totalSlashed = BigInt.fromI32(0);
    stats.averageReputation = BigInt.fromI32(0);
  }

  const providerContract = ProviderContract.bind(dataSource.address());
  const totalSlashed = providerContract.try_totalSlashed();

  if (!totalSlashed.reverted) {
    stats.totalSlashed = totalSlashed.value;
  }

  let totalProviderCount = BigInt.fromI32(0);
  let totalMachineCount = BigInt.fromI32(0);
  let totalStaked = BigInt.fromI32(0);
  let reputationSum = BigInt.fromI32(0);
  let activeProviderCount = 0;

  // This is a simplistic way to calculate global stats
  // In a production environment, you might want to keep track of these values incrementally
  // rather than recalculating everything each time

  stats.lastUpdatedAt = timestamp;
  stats.save();
}

function formatDate(timestamp: BigInt): string {
  const date = new Date(timestamp.toI64() * 1000);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}
