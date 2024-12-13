import { BigInt } from "@graphprotocol/graph-ts";
import { PoolCreated } from "../generated/SubnetStakingPoolFactory/SubnetStakingPoolFactory";
import { Pool } from "../generated/schema";
import { SubnetStakingPool as SubnetStakingPoolTemplate } from "../generated/templates";

export function handlePoolCreated(event: PoolCreated): void {
  // Lưu thông tin pool trong entity Pool
  let pool = new Pool(event.params.poolAddress.toHex());
  pool.stakingToken = event.params.stakingToken.toHex();
  pool.rewardToken = event.params.rewardToken.toHex();
  pool.totalStaked =  BigInt.fromI32(0);
  pool.totalRewardsClaimed =  BigInt.fromI32(0);
  pool.save();

  // Tạo một instance của SubnetStakingPool template
  SubnetStakingPoolTemplate.create(event.params.poolAddress);
}
