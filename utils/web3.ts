import * as anchor from '@coral-xyz/anchor';
import * as borsh from 'borsh';

import { delay } from './index';
import { formatUnits } from './formatting';
import { MeshStaking } from '../target/types/mesh_staking';

export async function airdropSol(
  connection: anchor.web3.Connection,
  receiver: anchor.web3.PublicKey,
  amountInSol: number
) {
  const txSig = await connection.requestAirdrop(
    receiver,
    anchor.web3.LAMPORTS_PER_SOL * amountInSol
  );
  const latestBlockHash = await connection.getLatestBlockhash();
  return connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSig,
  });
}

export async function getConfirmedTransaction(connection: anchor.web3.Connection, txId: string) {
  const tx = await connection.getTransaction(txId, { commitment: 'confirmed' });
  if (tx) {
    return tx;
  }

  await delay(1 * 1000);

  return await getConfirmedTransaction(connection, txId);
}

export function getReturnData(logs: string[]) {
  const prefix = 'Program return: ';
  let returnLog = logs.find(log => log.startsWith(prefix));
  returnLog = returnLog.slice(prefix.length);

  const [, data] = returnLog.split(' ', 2);
  return Buffer.from(data, 'base64');
}

export class Assignable {
  constructor(properties) {
    Object.keys(properties).map(key => {
      this[key] = properties[key];
    });
  }
}

export function decode_struct(returnType: any, fields: string[][], logs: string[]) {
  const buffer = getReturnData(logs);
  const schema = new Map([
    [
      returnType,
      {
        kind: 'struct',
        fields,
      },
    ],
  ]);

  return borsh.deserialize(schema, returnType, buffer);
}

export async function userPedningRewards(
  program: anchor.Program<MeshStaking>,
  user: anchor.web3.Keypair
) {
  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    program.programId
  );

  const [userInfo] = anchor.web3.PublicKey.findProgramAddressSync(
    [user.publicKey.toBuffer(), Buffer.from('user_info')],
    program.programId
  );

  const result = await program.methods
    .pendingRewards(user.publicKey)
    .accounts({ globalState, userInfo })
    .simulate();

  class RewardReturnType extends Assignable {
    mesh_reward: anchor.BN;
    index_mesh_reward: anchor.BN;
  }

  const data = decode_struct(
    RewardReturnType,
    [
      ['mesh_reward', 'u64'],
      ['index_mesh_reward', 'u64'],
    ],
    [...result.raw]
  ) as RewardReturnType;

  return {
    meshReward: formatUnits(data.mesh_reward),
    indexMeshReward: formatUnits(data.index_mesh_reward),
  };
}
