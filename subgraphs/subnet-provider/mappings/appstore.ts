import { BigInt, Address } from "@graphprotocol/graph-ts"
import { RewardClaimed, UsageReported, AppCreated, LockedRewardPaid } from "../generated/SubnetAppStore/SubnetAppStore"
import { Usage, App, AppProvider } from "../generated/schema"
import { SubnetAppStore } from "../generated/SubnetAppStore/SubnetAppStore"

export function handleRewardClaimed(event: RewardClaimed): void {
    let appProviderId = event.params.appId.toHex() + "-" + event.params.providerId.toHex()
    let appProvider = AppProvider.load(appProviderId)
    if (appProvider == null) {
        appProvider = new AppProvider(appProviderId)
        appProvider.app = event.params.appId.toHex()
        appProvider.provider = event.params.providerId.toHex()
        appProvider.pendingReward = BigInt.fromI32(0)
        appProvider.claimedReward = BigInt.fromI32(0)
        appProvider.lockedReward =  BigInt.fromI32(0)
        appProvider.unlockTime = BigInt.fromI32(0)
    }
    appProvider.pendingReward = BigInt.fromI32(0)
    appProvider.lockedReward = event.params.reward;
    appProvider.unlockTime = event.params.unlockTime;
    appProvider.save()
}

export function handleUsageReported(event: UsageReported): void {
    let usageId = event.params.appId.toHex() + "-" + event.params.peerId + "-" + event.params.timestamp.toString()
    let usage = new Usage(usageId)
    let peerId = event.params.providerId.toHex() + "-" + event.params.peerId

    usage.duration = event.params.duration
    usage.usedCpu = event.params.usedCpu
    usage.usedGpu = event.params.usedGpu
    usage.usedMemory = event.params.usedMemory
    usage.usedStorage = event.params.usedStorage
    usage.usedDownloadBytes = event.params.usedDownloadBytes
    usage.usedUploadBytes = event.params.usedUploadBytes
    usage.timestamp = event.params.timestamp
    usage.reward = event.params.reward
    usage.app = event.params.appId.toHex()
    usage.provider = event.params.providerId.toHex();
    usage.peer = peerId;

    usage.save()
}

export function handleAppCreated(event: AppCreated): void {
    let appId = event.params.appId.toHex()
    let contract = SubnetAppStore.bind(Address.fromString("0xCb0b58e5048e65248f2B0aF4d10623A2AAF03DC5"))
    let appData = contract.getApp(event.params.appId)

    let app = new App(appId)
    app.name = appData.name
    app.symbol = appData.symbol
    app.owner = appData.owner
    app.budget = appData.budget
    app.spentBudget = appData.spentBudget
    app.paymentToken = appData.paymentToken
    app.save()
}

export function handleLockedRewardPaid(event: LockedRewardPaid): void {
    let appProviderId = event.params.appId.toHex() + "-" + event.params.provider.toHex()
    let appProvider = AppProvider.load(appProviderId)
    if (appProvider == null) {
        appProvider = new AppProvider(appProviderId)
        appProvider.app = event.params.appId.toHex()
        appProvider.provider = event.params.provider.toHex()
        appProvider.pendingReward = BigInt.fromI32(0)
        appProvider.lockedReward =  BigInt.fromI32(0)
        appProvider.claimedReward = BigInt.fromI32(0)
    }

    appProvider.claimedReward = appProvider.claimedReward.plus(event.params.reward);
    appProvider.save()
}
