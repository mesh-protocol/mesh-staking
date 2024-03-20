import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

import { governanceKeypair } from './hooks';
import { assertBNEqual } from './genericTests';
import { delay } from '../utils';
import { parseUnits } from '../utils/formatting';
import { getConfirmedTransaction } from '../utils/web3';
import { MeshStaking } from '../target/types/mesh_staking';

describe('update_rewards', () => {
  const program = anchor.workspace.MeshStaking as Program<MeshStaking>;

  const connection = anchor.getProvider().connection;

  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    program.programId
  );

  const reward = parseUnits(10);
  const distributionTime = new anchor.BN(30 * 24 * 60 * 60);

  it('set rewards', async () => {
    const txId = await program.methods
      .updateRewards(reward, distributionTime)
      .accounts({
        governance: governanceKeypair.publicKey,
        globalState,
      })
      .signers([governanceKeypair])
      .rpc();

    const gs = await program.account.globalState.fetch(globalState);
    const txn = await getConfirmedTransaction(connection, txId);

    assertBNEqual(gs.reward, reward);
    assertBNEqual(gs.distributionTime, distributionTime);
    assertBNEqual(gs.periodEndTime, txn.blockTime + distributionTime.toNumber());
    assertBNEqual(gs.lastUpdatedTime, 0);
  });

  it('set rewards again before period end', async () => {
    const newReward = parseUnits(5);
    const newDistributionTime = new anchor.BN(3);

    const gsPrev = await program.account.globalState.fetch(globalState);

    const txId = await program.methods
      .updateRewards(newReward, newDistributionTime)
      .accounts({
        governance: governanceKeypair.publicKey,
        globalState,
      })
      .signers([governanceKeypair])
      .rpc();

    const gs = await program.account.globalState.fetch(globalState);
    const txn = await getConfirmedTransaction(connection, txId);

    const remainingRewards = gsPrev.periodEndTime
      .sub(new anchor.BN(txn.blockTime))
      .mul(reward)
      .div(distributionTime);

    assertBNEqual(gs.reward, newReward.add(remainingRewards));
    assertBNEqual(gs.distributionTime, newDistributionTime);
    assertBNEqual(gs.periodEndTime, txn.blockTime + newDistributionTime.toNumber());
    assertBNEqual(gs.lastUpdatedTime, txn.blockTime);
  });

  it('set rewards again after period end', async () => {
    await delay(5 * 1000);

    const newReward = parseUnits(10);

    const gsRev = await program.account.globalState.fetch(globalState);

    const txId = await program.methods
      .updateRewards(newReward, distributionTime)
      .accounts({
        governance: governanceKeypair.publicKey,
        globalState,
      })
      .signers([governanceKeypair])
      .rpc();

    const gs = await program.account.globalState.fetch(globalState);
    const txn = await getConfirmedTransaction(connection, txId);

    assertBNEqual(gs.reward, newReward);
    assertBNEqual(gs.distributionTime, distributionTime);
    assertBNEqual(gs.periodEndTime, txn.blockTime + distributionTime.toNumber());
    assertBNEqual(gs.lastUpdatedTime, gsRev.periodEndTime);
  });
});
