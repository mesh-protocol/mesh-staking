import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

import { meshMint, indexMeshMint, governanceKeypair } from './hooks';
import { assertKeysEqual, assertBNEqual } from './genericTests';
import { parseUnits } from '../utils/formatting';
import { MeshStaking } from '../target/types/mesh_staking';

describe('initialize', () => {
  const program = anchor.workspace.MeshStaking as Program<MeshStaking>;

  const connection = anchor.getProvider().connection;

  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    program.programId
  );

  const [fundsController] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('funds_controller')],
    program.programId
  );

  const meshVault = getAssociatedTokenAddressSync(
    meshMint,
    fundsController,
    true,
    TOKEN_PROGRAM_ID
  );

  const indexMeshVault = getAssociatedTokenAddressSync(
    indexMeshMint,
    fundsController,
    true,
    TOKEN_PROGRAM_ID
  );

  const createMeshATAix = createAssociatedTokenAccountInstruction(
    program.provider.publicKey,
    meshVault,
    fundsController,
    meshMint
  );

  const createindexMeshATAix = createAssociatedTokenAccountInstruction(
    program.provider.publicKey,
    indexMeshVault,
    fundsController,
    indexMeshMint
  );

  const weightage = parseUnits(0.5);

  it('initialize staking program', async () => {
    await program.methods
      .initialize(governanceKeypair.publicKey, meshMint, indexMeshMint, weightage)
      .preInstructions([createMeshATAix, createindexMeshATAix])
      .accounts({
        payer: program.provider.publicKey,
        globalState,
        fundsController,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const gs = await program.account.globalState.fetch(globalState);

    assertKeysEqual(gs.governance, governanceKeypair.publicKey);
    assertKeysEqual(gs.meshMint, meshMint);
    assertKeysEqual(gs.indexMeshMint, indexMeshMint);
    assertBNEqual(gs.weightage, weightage);

    const [meshATA, indexMeshATA] = await Promise.all([
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
    ]);

    assertKeysEqual(meshATA.mint, meshMint);
    assertKeysEqual(meshATA.owner, fundsController);

    assertKeysEqual(indexMeshATA.mint, indexMeshMint);
    assertKeysEqual(indexMeshATA.owner, fundsController);
  });
});
