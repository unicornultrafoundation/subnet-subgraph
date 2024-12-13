import { VaultCreated } from "../generated/SubnetNftVaultFactory/SubnetNftVaultFactory";
import { Vault } from "../generated/schema";

export function handleVaultCreated(event: VaultCreated): void {
  let vault = new Vault(event.params.vaultAddress.toHex());
  vault.nftContract = event.params.nftContract;
  vault.vaultAddress = event.params.vaultAddress;
  vault.save();
}
