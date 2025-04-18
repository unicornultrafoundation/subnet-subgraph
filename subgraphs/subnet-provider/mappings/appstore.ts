import { BigInt, Address } from "@graphprotocol/graph-ts"
import { RewardClaimed, UsageReported, AppCreated, LockedRewardPaid } from "../generated/SubnetAppStore/SubnetAppStore"
import { Usage, App, AppProvider, AppPeer, Peer, TotalUsage, PeerTotalUsage, DailyResourceUsage, WeeklyResourceUsage, MonthlyResourceUsage } from "../generated/schema"
import { SubnetAppStore } from "../generated/SubnetAppStore/SubnetAppStore"

class DateInfo {
    constructor(
        public date: string,
        public week: string,
        public month: string,
        public timestamp: BigInt
    ) { }
}

function getDateInfo(timestamp: BigInt): DateInfo {
    let date = new Date(timestamp.toI64() * 1000)

    // Get Date with format YYYY-MM-DD
    let year = date.getUTCFullYear().toString()
    let month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    let day = date.getUTCDate().toString().padStart(2, '0')
    let dateStr = `${year}-${month}-${day}`

    // Get Month with format YYYY-MM
    let monthStr = `${year}-${month}`

    // Get ISO week number
    let target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    let dayNum = target.getUTCDay() || 7
    target.setUTCDate(target.getUTCDate() + 4 - dayNum)
    let firstDayOfYear = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))


    const daysDifference = (target.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = (daysDifference + 1) / 7;
    let weekStr = `${year}-W${weekNumber.toString().padStart(2, '0')}`

    return new DateInfo(dateStr, weekStr, monthStr, timestamp)
}

function getOrCreateDailyResourceUsage(
    appId: string,
    peerId: string,
    providerId: string,
    dateInfo: DateInfo
): DailyResourceUsage {
    let id = `${appId}-${peerId}-${providerId}-${dateInfo.date}`
    let usage = DailyResourceUsage.load(id)

    if (usage == null) {
        usage = new DailyResourceUsage(id)
        usage.app = appId
        usage.peer = peerId
        usage.provider = providerId
        usage.dateKey = dateInfo.date
        usage.timestamp = dateInfo.timestamp
        usage.totalCpu = BigInt.fromI32(0)
        usage.totalGpu = BigInt.fromI32(0)
        usage.totalMemory = BigInt.fromI32(0)
        usage.totalStorage = BigInt.fromI32(0)
        usage.totalDownloadBytes = BigInt.fromI32(0)
        usage.totalUploadBytes = BigInt.fromI32(0)
        usage.totalDuration = BigInt.fromI32(0)
        usage.totalReward = BigInt.fromI32(0)
    }

    return usage
}

function getOrCreateWeeklyResourceUsage(
    appId: string,
    peerId: string,
    providerId: string,
    dateInfo: DateInfo
): WeeklyResourceUsage {
    let id = `${appId}-${peerId}-${providerId}-${dateInfo.week}`
    let usage = WeeklyResourceUsage.load(id)

    if (usage == null) {
        usage = new WeeklyResourceUsage(id)
        usage.app = appId
        usage.peer = peerId
        usage.provider = providerId
        usage.dateKey = dateInfo.week
        usage.timestamp = dateInfo.timestamp
        usage.totalCpu = BigInt.fromI32(0)
        usage.totalGpu = BigInt.fromI32(0)
        usage.totalMemory = BigInt.fromI32(0)
        usage.totalStorage = BigInt.fromI32(0)
        usage.totalDownloadBytes = BigInt.fromI32(0)
        usage.totalUploadBytes = BigInt.fromI32(0)
        usage.totalDuration = BigInt.fromI32(0)
        usage.totalReward = BigInt.fromI32(0)
    }

    return usage
}

function getOrCreateMonthlyResourceUsage(
    appId: string,
    peerId: string,
    providerId: string,
    dateInfo: DateInfo
): MonthlyResourceUsage {
    let id = `${appId}-${peerId}-${providerId}-${dateInfo.month}`
    let usage = MonthlyResourceUsage.load(id)

    if (usage == null) {
        usage = new MonthlyResourceUsage(id)
        usage.app = appId
        usage.peer = peerId
        usage.provider = providerId
        usage.dateKey = dateInfo.month
        usage.timestamp = dateInfo.timestamp
        usage.totalCpu = BigInt.fromI32(0)
        usage.totalGpu = BigInt.fromI32(0)
        usage.totalMemory = BigInt.fromI32(0)
        usage.totalStorage = BigInt.fromI32(0)
        usage.totalDownloadBytes = BigInt.fromI32(0)
        usage.totalUploadBytes = BigInt.fromI32(0)
        usage.totalDuration = BigInt.fromI32(0)
        usage.totalReward = BigInt.fromI32(0)
    }

    return usage
}

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
        appProvider.lockedReward = BigInt.fromI32(0)
        appProvider.unlockTime = BigInt.fromI32(0)
    }

    let appPeerId = event.params.appId.toHex() + "-" + event.params.peerId
    let appPeer = AppPeer.load(appPeerId)
    let isNewPeer = false;
    if (appPeer == null) {
        appPeer = new AppPeer(appPeerId)
        appPeer.app = event.params.appId.toHex()
        appPeer.peer = peerId
        appPeer.reward = BigInt.fromI32(0)
        isNewPeer = true;
    }

    appPeer.reward = appPeer.reward.plus(event.params.reward)
    appPeer.save();


    appProvider.pendingReward = appProvider.pendingReward.plus(event.params.reward)
    appProvider.save()

    let app = App.load(event.params.appId.toHex())

    if (app != null) {
        if (isNewProvider == true) {
            app.providerCount = app.providerCount.plus(BigInt.fromI32(1))
        }

        if (isNewPeer == true) {
            app.peerCount = app.peerCount.plus(BigInt.fromI32(1))
        }

        app.save()
    }

    let totalUsage = TotalUsage.load("total")
    if (totalUsage == null) {
        totalUsage = new TotalUsage("total")
        totalUsage.totalCpu = BigInt.fromI32(0)
        totalUsage.totalGpu = BigInt.fromI32(0)
        totalUsage.totalMemory = BigInt.fromI32(0)
        totalUsage.totalStorage = BigInt.fromI32(0)
        totalUsage.totalDownloadBytes = BigInt.fromI32(0)
        totalUsage.totalUploadBytes = BigInt.fromI32(0)
        totalUsage.totalDuration = BigInt.fromI32(0)
        totalUsage.totalPeerCount = BigInt.fromI32(0)
        totalUsage.totalProviderCount = BigInt.fromI32(0)
    }

    totalUsage.totalCpu = totalUsage.totalCpu.plus(event.params.usedCpu)
    totalUsage.totalGpu = totalUsage.totalGpu.plus(event.params.usedGpu)
    totalUsage.totalMemory = totalUsage.totalMemory.plus(event.params.usedMemory)
    totalUsage.totalStorage = totalUsage.totalStorage.plus(event.params.usedStorage)
    totalUsage.totalDownloadBytes = totalUsage.totalDownloadBytes.plus(event.params.usedDownloadBytes)
    totalUsage.totalUploadBytes = totalUsage.totalUploadBytes.plus(event.params.usedUploadBytes)
    totalUsage.totalDuration = totalUsage.totalDuration.plus(event.params.duration)

    // handle peer total usage
    let peerTotalUsageId = event.params.peerId
    let peerTotalUsage = PeerTotalUsage.load(peerTotalUsageId)
    if (peerTotalUsage == null) {
        peerTotalUsage = new PeerTotalUsage(peerTotalUsageId)
        peerTotalUsage.app = event.params.appId.toHex()
        peerTotalUsage.totalCpu = BigInt.fromI32(0)
        peerTotalUsage.totalGpu = BigInt.fromI32(0)
        peerTotalUsage.totalMemory = BigInt.fromI32(0)
        peerTotalUsage.totalStorage = BigInt.fromI32(0)
        peerTotalUsage.totalDownloadBytes = BigInt.fromI32(0)
        peerTotalUsage.totalUploadBytes = BigInt.fromI32(0)
        peerTotalUsage.totalDuration = BigInt.fromI32(0)

    }
    peerTotalUsage.totalCpu = peerTotalUsage.totalCpu.plus(event.params.usedCpu)
    peerTotalUsage.totalGpu = peerTotalUsage.totalCpu.plus(event.params.usedGpu)
    peerTotalUsage.totalMemory = peerTotalUsage.totalCpu.plus(event.params.usedMemory)
    peerTotalUsage.totalStorage = peerTotalUsage.totalCpu.plus(event.params.usedStorage)
    peerTotalUsage.totalDownloadBytes = peerTotalUsage.totalDownloadBytes.plus(event.params.usedDownloadBytes)
    peerTotalUsage.totalUploadBytes = peerTotalUsage.totalUploadBytes.plus(event.params.usedUploadBytes)
    peerTotalUsage.totalDuration = peerTotalUsage.totalDuration.plus(event.params.duration)
    peerTotalUsage.timestamp = event.params.timestamp
    peerTotalUsage.save()


    if (isNewProvider) {
        totalUsage.totalProviderCount = totalUsage.totalProviderCount.plus(BigInt.fromI32(1))
    }

    if (isNewPeer) {
        totalUsage.totalPeerCount = totalUsage.totalPeerCount.plus(BigInt.fromI32(1))
    }

    totalUsage.save()

    // Get date information
    let dateInfo = getDateInfo(event.params.timestamp)
    let peer = Peer.load(event.params.peerId)
    if (!peer) {
        peer = new Peer(event.params.peerId)
        peer.save()
    }


    // Update daily resource usage
    let dailyUsage = getOrCreateDailyResourceUsage(
        event.params.appId.toHex(),
        event.params.peerId,
        event.params.providerId.toHex(),
        dateInfo
    )

    dailyUsage.totalCpu = dailyUsage.totalCpu.plus(event.params.usedCpu)
    dailyUsage.totalGpu = dailyUsage.totalGpu.plus(event.params.usedGpu)
    dailyUsage.totalMemory = dailyUsage.totalMemory.plus(event.params.usedMemory)
    dailyUsage.totalStorage = dailyUsage.totalStorage.plus(event.params.usedStorage)
    dailyUsage.totalDownloadBytes = dailyUsage.totalDownloadBytes.plus(event.params.usedDownloadBytes)
    dailyUsage.totalUploadBytes = dailyUsage.totalUploadBytes.plus(event.params.usedUploadBytes)
    dailyUsage.totalDuration = dailyUsage.totalDuration.plus(event.params.duration)
    dailyUsage.totalReward = dailyUsage.totalReward.plus(event.params.reward)

    dailyUsage.save()

    // Update weekly resource usage
    let weeklyUsage = getOrCreateWeeklyResourceUsage(
        event.params.appId.toHex(),
        event.params.peerId,
        event.params.providerId.toHex(),
        dateInfo
    )
    weeklyUsage.totalCpu = weeklyUsage.totalCpu.plus(event.params.usedCpu)
    weeklyUsage.totalGpu = weeklyUsage.totalGpu.plus(event.params.usedGpu)
    weeklyUsage.totalMemory = weeklyUsage.totalMemory.plus(event.params.usedMemory)
    weeklyUsage.totalStorage = weeklyUsage.totalStorage.plus(event.params.usedStorage)
    weeklyUsage.totalDownloadBytes = weeklyUsage.totalDownloadBytes.plus(event.params.usedDownloadBytes)
    weeklyUsage.totalUploadBytes = weeklyUsage.totalUploadBytes.plus(event.params.usedUploadBytes)
    weeklyUsage.totalDuration = weeklyUsage.totalDuration.plus(event.params.duration)
    weeklyUsage.totalReward = weeklyUsage.totalReward.plus(event.params.reward)
    weeklyUsage.save()

    // Update monthly resource usage
    let monthlyUsage = getOrCreateMonthlyResourceUsage(
        event.params.appId.toHex(),
        event.params.peerId,
        event.params.providerId.toHex(),
        dateInfo
    )
    monthlyUsage.totalCpu = monthlyUsage.totalCpu.plus(event.params.usedCpu)
    monthlyUsage.totalGpu = monthlyUsage.totalGpu.plus(event.params.usedGpu)
    monthlyUsage.totalMemory = monthlyUsage.totalMemory.plus(event.params.usedMemory)
    monthlyUsage.totalStorage = monthlyUsage.totalStorage.plus(event.params.usedStorage)
    monthlyUsage.totalDownloadBytes = monthlyUsage.totalDownloadBytes.plus(event.params.usedDownloadBytes)
    monthlyUsage.totalUploadBytes = monthlyUsage.totalUploadBytes.plus(event.params.usedUploadBytes)
    monthlyUsage.totalDuration = monthlyUsage.totalDuration.plus(event.params.duration)
    monthlyUsage.totalReward = monthlyUsage.totalReward.plus(event.params.reward)
    monthlyUsage.save()
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
