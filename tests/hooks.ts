import * as anchor from '@coral-xyz/anchor';
import { MintLayout, TOKEN_PROGRAM_ID, createInitializeMintInstruction } from '@solana/spl-token';

import { MeshStaking } from '../target/types/mesh_staking';
import { airdropSol } from '../utils/web3';

const meshMintKeypair = anchor.web3.Keypair.generate();
const indexMeshMintKeypair = anchor.web3.Keypair.generate();
export const governanceKeypair = anchor.web3.Keypair.generate();

export const userOne = anchor.web3.Keypair.generate();
export const userTwo = anchor.web3.Keypair.generate();

export const meshMint = meshMintKeypair.publicKey;
export const indexMeshMint = indexMeshMintKeypair.publicKey;

const MESH_MINT_DECIMALS = 9;
const INDEX_MESH_MINT_DECIMALS = 9;

export const mochaHooks = {
  /* Before hook to run before all tests */
  beforeAll: [
    async () => {
      // Configure the client to use the local cluster.
      anchor.setProvider(anchor.AnchorProvider.env());

      const connection = anchor.getProvider().connection;

      await Promise.all([
        airdropSol(connection, governanceKeypair.publicKey, 10),
        airdropSol(connection, userOne.publicKey, 10),
        airdropSol(connection, userTwo.publicKey, 10),
      ]);

      await createMeshTokens();
    },
  ],
};

async function createMeshTokens() {
  const program = anchor.workspace.MeshStaking as anchor.Program<MeshStaking>;
  const mintRentExemptBalance = await program.provider.connection.getMinimumBalanceForRentExemption(
    MintLayout.span
  );

  const tx = new anchor.web3.Transaction();

  // create $Mesh token
  tx.add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: program.provider.publicKey,
      newAccountPubkey: meshMint,
      space: MintLayout.span,
      lamports: mintRentExemptBalance,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  tx.add(
    createInitializeMintInstruction(
      meshMint,
      MESH_MINT_DECIMALS,
      governanceKeypair.publicKey,
      undefined
    )
  );

  // create $indexMesh token
  tx.add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: program.provider.publicKey,
      newAccountPubkey: indexMeshMint,
      space: MintLayout.span,
      lamports: mintRentExemptBalance,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  tx.add(
    createInitializeMintInstruction(
      indexMeshMint,
      INDEX_MESH_MINT_DECIMALS,
      governanceKeypair.publicKey,
      undefined
    )
  );

  const txId = await program.provider.sendAndConfirm(tx, [meshMintKeypair, indexMeshMintKeypair]);
}
