import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

import { governanceKeypair } from './hooks';
import { assertBNEqual } from './genericTests';
import { parseUnits } from '../utils/formatting';
import { MeshStaking } from '../target/types/mesh_staking';

describe('update weightage', () => {
  const program = anchor.workspace.MeshStaking as Program<MeshStaking>;

  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    program.programId
  );

  it('Set weightage for indexMesh', async () => {
    const weightage = parseUnits(0.5);
    await program.methods
      .updateWeightage(weightage)
      .accounts({
        governance: governanceKeypair.publicKey,
        globalState,
      })
      .signers([governanceKeypair]) //signing txn by governance
      .rpc();

    const gs = await program.account.globalState.fetch(globalState);

    assertBNEqual(gs.weightage, weightage);
    assertBNEqual(gs.globalAccRewardMesh, 0);
    assertBNEqual(gs.globalAccRewardIndexMesh, 0);
  });
});
