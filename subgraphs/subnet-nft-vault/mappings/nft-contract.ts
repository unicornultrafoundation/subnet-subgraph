import { Transfer } from "../generated/NFTContract/ERC721";
import { NFT, Vault } from "../generated/schema";

export function handleTransfer(event: Transfer): void {
    let nftId = event.address.toHex() + "-" + event.params.tokenId.toString();
    let nft = NFT.load(nftId);

    if (!nft) {
        nft = new NFT(nftId);
        nft.contract = event.address;
        nft.tokenId = event.params.tokenId;
    }

    let vault = Vault.load(event.params.to.toHex())

    if (!vault) {
        // Cập nhật chủ sở hữu mới
        nft.owner = event.params.to;
        
    } else {
        nft.vault = event.params.to;
    }

    nft.save();
}
