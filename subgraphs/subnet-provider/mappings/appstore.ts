import { BigInt, Address } from "@graphprotocol/graph-ts"
import { RewardClaimed, UsageReported, AppCreated, LockedRewardPaid } from "../generated/SubnetAppStore/SubnetAppStore"
import { Usage, App, AppProvider, AppPeer } from "../generated/schema"
import { SubnetAppStore } from "../generated/SubnetAppStore/SubnetAppStore"

export function handleRewardClaimed(event: RewardClaimed): void {
    let appProviderId = event.params.appId.toHex() + "-" + event.params.providerId.toHex()
    let appProvider = AppProvider.load(appProviderId)
    if (appProvider != null) {
        appProvider.pendingReward = BigInt.fromI32(0)
        appProvider.lockedReward = event.params.reward;
        appProvider.unlockTime = event.params.unlockTime;
        appProvider.save()
    }
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

    let appProviderId = event.params.appId.toHex() + "-" + event.params.providerId.toHex()
    let appProvider = AppProvider.load(appProviderId)
    let isNewProvider = false;
    if (appProvider == null) {
        isNewProvider = true;
        appProvider = new AppProvider(appProviderId)
        appProvider.app = event.params.appId.toHex()
        appProvider.provider = event.params.providerId.toHex()
        appProvider.pendingReward = BigInt.fromI32(0)
        appProvider.claimedReward = BigInt.fromI32(0)
        appProvider.lockedReward =  BigInt.fromI32(0)
        appProvider.unlockTime = BigInt.fromI32(0)
    }

    let appPeerId = event.params.appId.toHex() + "-" + event.params.peerId
    let appPeer = AppPeer.load(appPeerId)
    let isNewPeer = false;
    if (appPeer == null) {
        appPeer = new AppPeer(appPeerId)
        appPeer.app = event.params.appId.toHex()
        appPeer.peer = event.params.peerId
        appPeer.reward =  BigInt.fromI32(0)
        isNewPeer = true;
    }

    appPeer.reward = appPeer.reward.plus(event.params.reward)
    appPeer.save();


    appProvider.pendingReward =  appProvider.pendingReward.plus(event.params.reward)
    appProvider.save()

    let app = App.load(event.params.appId.toHex())

    if (app != null) {
        if (isNewProvider == true ) {
            app.providerCount = app.providerCount.plus(BigInt.fromI32(1))
        }
    
        if (isNewPeer == true) {
            app.peerCount = app.peerCount.plus(BigInt.fromI32(1))
        }
    
        app.save()
    }
    
}

export function handleAppCreated(event: AppCreated): void {
    let appId = event.params.appId.toHex()
    let contract = SubnetAppStore.bind(Address.fromString("0x5F49358D7717D001Cd5B8bF5613b9bc14cE3dBd2"))
    let appData = contract.getApp(event.params.appId)

    let app = new App(appId)
    app.name = appData.name
    app.symbol = appData.symbol
    app.owner = appData.owner
    app.budget = appData.budget
    app.spentBudget = appData.spentBudget
    app.paymentToken = appData.paymentToken
    app.peerCount = BigInt.fromI32(0)
    app.providerCount = BigInt.fromI32(0)
    app.save()
}

export function handleLockedRewardPaid(event: LockedRewardPaid): void {
    let appProviderId = event.params.appId.toHex() + "-" + event.params.provider.toHex()
    let appProvider = AppProvider.load(appProviderId)
    if (appProvider != null) {
        appProvider.claimedReward = appProvider.claimedReward.plus(event.params.reward);
        appProvider.save()
    }
}
