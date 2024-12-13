import { BigInt } from "@graphprotocol/graph-ts";
import {
  Staked as StakedEvent,
  Withdrawn as WithdrawnEvent,
  RewardClaimed as RewardClaimedEvent,
} from "../generated/templates/SubnetStakingPool/SubnetStakingPool";
import { User, History, Pool, UserPool } from "../generated/schema";

// Utility function to fetch or initialize a User entity
function getUser(userId: string): User {
  let user = User.load(userId);
  if (!user) {
    user = new User(userId);
    user.save();
  }
  return user;
}

// Utility function to fetch or initialize a Pool entity
function getPool(poolId: string): Pool {
  let pool = Pool.load(poolId);
  if (!pool) {
    pool = new Pool(poolId);
    pool.save();
  }
  return pool;
}

// Utility function to fetch or initialize a UserPool entity
function getUserPool(userId: string, poolId: string): UserPool {
  const id = `${userId}-${poolId}`;
  let userPool = UserPool.load(id);

  if (!userPool) {
    const user = getUser(userId);
    const pool = Pool.load(poolId);
    if (!pool) {
      throw new Error(`Pool does not exist: ${poolId}`);
    }

    userPool = new UserPool(id);
    userPool.user = user.id;
    userPool.pool = pool.id;
    userPool.totalStaked = BigInt.fromI32(0);
    userPool.totalRewardsClaimed = BigInt.fromI32(0);
    userPool.save();
  }

  return userPool;
}

// Utility function to create and save a History entity
function createHistory(
  id: string,
  userPool: UserPool,
  type: string,
  amount: BigInt,
  timestamp: BigInt,
  txHash: string
): void {
  const history = new History(id);
  history.user = userPool.user;
  history.pool = userPool.pool;
  history.type = type;
  history.amount = amount;
  history.timestamp = timestamp;
  history.txHash = txHash;
  history.save();
}

// Handle Staked event
export function handleStake(event: StakedEvent): void {
  const userPool = getUserPool(event.params.user.toHex(), event.address.toHex());

  // Update total staked
  userPool.totalStaked = userPool.totalStaked.plus(event.params.amount);
  userPool.save();

  const pool = getPool(userPool.pool)
  pool.totalStaked = pool.totalStaked.plus(event.params.amount);
  pool.save()

  // Create history record
  createHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`,
    userPool,
    "STAKE",
    event.params.amount,
    event.block.timestamp,
    event.transaction.hash.toHex()
  );
}

// Handle Withdrawn event
export function handleWithdraw(event: WithdrawnEvent): void {
  const userPool = getUserPool(event.params.user.toHex(), event.address.toHex());

  // Update total staked (decrease by withdrawn amount)
  userPool.totalStaked = userPool.totalStaked.minus(event.params.amount);
  userPool.save();

  const pool = Pool.load(userPool.pool)
  pool!.totalStaked = pool!.totalStaked.minus(event.params.amount);
  pool!.save()

  // Create history record
  createHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`,
    userPool,
    "WITHDRAW",
    event.params.amount,
    event.block.timestamp,
    event.transaction.hash.toHex()
  );
}

// Handle RewardClaimed event
export function handleClaim(event: RewardClaimedEvent): void {
  const userPool = getUserPool(event.params.user.toHex(), event.address.toHex());

  // Update total rewards claimed
  userPool.totalRewardsClaimed = userPool.totalRewardsClaimed.plus(event.params.reward);
  userPool.save();

  const pool = Pool.load(userPool.pool)
  pool!.totalRewardsClaimed = pool!.totalRewardsClaimed.plus(event.params.reward);
  pool!.save()
  // Create history record
  createHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`,
    userPool,
    "CLAIM",
    event.params.reward,
    event.block.timestamp,
    event.transaction.hash.toHex()
  );
}
