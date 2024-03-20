import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorError } from '@coral-xyz/anchor';
import { assert } from 'chai';

import { governanceKeypair } from './hooks';
import { parseUnits } from '../utils/formatting';
import { MeshStaking } from '../target/types/mesh_staking';

describe('migrateFunds', () => {
  const program = anchor.workspace.MeshStaking as Program<MeshStaking>;
  const connection = anchor.getProvider().connection;

  const newVersion = anchor.web3.Keypair.generate();

  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    program.programId
  );

  const [fundsController] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('funds_controller')],
    program.programId
  );

  it('migrate funds more than rent exempt', async () => {
    const fcPrevSOlBalance = await connection.getBalance(fundsController);

    try {
      await program.methods
        .migrateFunds(new anchor.BN(fcPrevSOlBalance))
        .accounts({
          governance: governanceKeypair.publicKey,
          newVersion: newVersion.publicKey,
          globalState,
          fundsController,
        })
        .signers([governanceKeypair]) //signing txn by governance
        .rpc();
    } catch (error) {
      const errMsg = 'Insufficient funds';
      assert.equal((error as AnchorError).error.errorMessage, errMsg);
    }
  });

  it('migrate some SOL', async () => {
    const fcPrevSOlBalance = await connection.getBalance(fundsController);

    const amount = parseUnits(5);
    await program.methods
      .migrateFunds(amount)
      .accounts({
        governance: governanceKeypair.publicKey,
        newVersion: newVersion.publicKey,
        globalState,
        fundsController,
      })
      .signers([governanceKeypair]) //signing txn by governance
      .rpc();

    const fcNewSOlBalance = await connection.getBalance(fundsController);
    assert.equal(fcPrevSOlBalance, new anchor.BN(fcNewSOlBalance).add(amount).toNumber());
  });

  it('migrate all possible SOL', async () => {
    const fcAccount = await connection.getAccountInfo(fundsController);
    const rent = await connection.getMinimumBalanceForRentExemption(fcAccount.data.length);
    const fcPrevSOlBalance = await connection.getBalance(fundsController);

    await program.methods
      .migrateFunds(new anchor.BN(fcPrevSOlBalance - (rent + 1)))
      .accounts({
        governance: governanceKeypair.publicKey,
        newVersion: newVersion.publicKey,
        globalState,
        fundsController,
      })
      .signers([governanceKeypair]) //signing txn by governance
      .rpc();

    const fcNewSOlBalance = await connection.getBalance(fundsController);
    assert.equal(fcNewSOlBalance, rent + 1);
  });
});
