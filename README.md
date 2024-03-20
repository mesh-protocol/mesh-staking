# Staking Program

It's the program deployed on Solana which supports the staking of $MESH and $indexMESH. It allows user to stake these two SPL tokens and collect reward in SOL which will be accumulated per sec and distributed proportionally between all stakers.

## Requirements

- Anchor 0.29.0
- Solana 1.18.1
- Rust 1.75.0

## Setup

Install Anchor using instructions found [here](https://book.anchor-lang.com/getting_started/installation.html#anchor).

Set up a valid Solana keypair at the path specified in the `wallet` in `Anchor.toml` and replace the pubkey of DEPLOYER with that account key in `state.rs`.

To do local testing with `anchor test` flows.

## Addresses

<!-- Disable table formatting because Prettier messing it up. -->
<!-- prettier-ignore -->
| Account   | Pubkey                                       |
| ----------| --------------------------------------------|
| **Devnet** ||
| Program    | HcgqAqH5MwpTACy2PXA91ecu98hr1Ewt7YAf5mHeT7zY |
| MESH       | MESHwqmXvAmKpDYSgRZkm9D5H8xYSCVixeyZoePHn4G  |
| indexMESH  | iMESHdxK4fgZLU3FDTsT4tYatHXBbodQVParussnFMy  |
