import * as anchor from '@coral-xyz/anchor';
import * as borsh from 'borsh';
import { assert } from 'chai';

import { limitPrecision, formatUnits } from './formatting';
import { MeshStaking } from '../target/types/mesh_staking';

interface ProgramGlobalState {
  globalAccRewardMesh: anchor.BN;
  globalAccRewardIndexMesh: anchor.BN;
  totalStakedMesh: anchor.BN;
  totalStakedIndexMesh: anchor.BN;
}

interface ProgramUserState {
  accRewardMesh: anchor.BN;
  accRewardIndexMesh: anchor.BN;
  stakedMesh: anchor.BN;
  stakedIndexMesh: anchor.BN;
}

export class GlobalStateClone {
  public globalAccRewardMesh: number = 0;
  public globalAccRewardIndexMesh: number = 0;
  public totalStakedMesh: number = 0;
  public totalStakedIndexMesh: number = 0;
  public weightage: number = 0;
  public lastUpdated: number = 0;
  public distributionTime: number = 0;
  public reward: number = 0;

  public updateRewardPerShare(currentTime: number) {
    const rewardPerSec = this.reward / this.distributionTime;
    const reward = (currentTime - this.lastUpdated) * rewardPerSec;
    const totalWeightedAmount = this.totalStakedMesh + this.totalStakedIndexMesh * this.weightage;

    if (totalWeightedAmount === 0) {
      this.lastUpdated = currentTime;
      return;
    }

    const accReward = reward / totalWeightedAmount;
    const accRewardIndexMesh = accReward * this.weightage;

    this.globalAccRewardMesh += accReward;
    this.globalAccRewardIndexMesh += accRewardIndexMesh;

    this.lastUpdated = currentTime;
  }

  public assertState(programState: ProgramGlobalState) {
    assert.isTrue(
      limitPrecision(programState.globalAccRewardMesh.toNumber() / 1e18, 18) ===
        limitPrecision(this.globalAccRewardMesh, 18) ||
        limitPrecision(programState.globalAccRewardMesh.toNumber() / 1e18, 16) ===
          limitPrecision(this.globalAccRewardMesh, 16),
      'mismatch globalAccRewardMesh'
    );

    assert.isTrue(
      limitPrecision(programState.globalAccRewardIndexMesh.toNumber() / 1e18, 18) ===
        limitPrecision(this.globalAccRewardIndexMesh, 18) ||
        limitPrecision(programState.globalAccRewardIndexMesh.toNumber() / 1e18, 16) ===
          limitPrecision(this.globalAccRewardIndexMesh, 16),
      'mismatch globalAccRewardIndexMesh'
    );

    assert.equal(
      limitPrecision(programState.totalStakedMesh.toNumber() / 1e9, 9),
      limitPrecision(this.totalStakedMesh, 9),
      'mismatch totalStakedMesh'
    );

    assert.equal(
      limitPrecision(programState.totalStakedIndexMesh.toNumber() / 1e9, 9),
      limitPrecision(this.totalStakedIndexMesh, 9),
      'mismatch totalStakedIndexMesh'
    );
  }

  public assertBalance(meshBalance: bigint, indexMeshBalance: bigint) {
    assert.equal(
      limitPrecision(Number(meshBalance.toString()) / 1e9, 9),
      limitPrecision(this.totalStakedMesh, 9),
      'mismatch mesh vault balance'
    );

    assert.equal(
      limitPrecision(Number(indexMeshBalance.toString()) / 1e9, 9),
      limitPrecision(this.totalStakedIndexMesh, 9),
      'mismatch indexMesh vault balance'
    );
  }
}

export class UserClone {
  public user: anchor.web3.PublicKey;
  public accRewardMesh: number = 0;
  public accRewardIndexMesh: number = 0;
  public stakedMesh: number = 0;
  public stakedIndexMesh: number = 0;
  public meshBalance: number = 0;
  public indexMeshBalance: number = 0;

  public globalState: GlobalStateClone;
  public collectedReward: Record<string, { meshReward: number; indexMeshReward: number }> = {};

  constructor(_user: anchor.web3.PublicKey, globalState: GlobalStateClone) {
    this.user = _user;
    this.globalState = globalState;
  }

  public pendingRewards() {
    const meshReward =
      (this.globalState.globalAccRewardMesh - this.accRewardMesh) * this.stakedMesh;
    const indexMeshReward =
      (this.globalState.globalAccRewardIndexMesh - this.accRewardIndexMesh) * this.stakedIndexMesh;

    return { meshReward, indexMeshReward };
  }

  public harvestReward(txId: string) {
    this.collectedReward[txId] = this.pendingRewards();

    this.accRewardMesh = this.globalState.globalAccRewardMesh;
    this.accRewardIndexMesh = this.globalState.globalAccRewardIndexMesh;
  }

  public stakeMesh(txId: string, currentTime: number, amount: number) {
    this.globalState.updateRewardPerShare(currentTime);

    this.harvestReward(txId);

    this.globalState.totalStakedMesh += amount;
    this.stakedMesh += amount;
  }

  public unstakeMesh(txId: string, currentTime: number, amount: number) {
    this.globalState.updateRewardPerShare(currentTime);

    this.harvestReward(txId);

    this.globalState.totalStakedMesh -= amount;
    this.stakedMesh -= amount;
  }

  public stakeIndexMesh(txId: string, currentTime: number, amount: number) {
    this.globalState.updateRewardPerShare(currentTime);

    this.harvestReward(txId);

    this.globalState.totalStakedIndexMesh += amount;
    this.stakedIndexMesh += amount;
  }

  public unstakeIndexMesh(txId: string, currentTime: number, amount: number) {
    this.globalState.updateRewardPerShare(currentTime);

    this.harvestReward(txId);

    this.globalState.totalStakedIndexMesh -= amount;
    this.stakedIndexMesh -= amount;
  }

  public claim(txId: string, currentTime: number) {
    this.globalState.updateRewardPerShare(currentTime);

    this.harvestReward(txId);
  }

  public assertState(programState: ProgramUserState) {
    assert.isTrue(
      limitPrecision(programState.accRewardMesh.toNumber() / 1e18, 18) ===
        limitPrecision(this.accRewardMesh, 18) ||
        limitPrecision(programState.accRewardMesh.toNumber() / 1e18, 16) ===
          limitPrecision(this.accRewardMesh, 16),
      'mismatch accRewardMesh'
    );

    assert.isTrue(
      limitPrecision(programState.accRewardIndexMesh.toNumber() / 1e18, 18) ===
        limitPrecision(this.accRewardIndexMesh, 18) ||
        limitPrecision(programState.accRewardIndexMesh.toNumber() / 1e18, 16) ===
          limitPrecision(this.accRewardIndexMesh, 16),
      'mismatch accRewardMesh'
    );

    assert.equal(
      limitPrecision(programState.stakedMesh.toNumber() / 1e9, 9),
      limitPrecision(this.stakedMesh, 9),
      'mismatch stakedMesh'
    );

    assert.equal(
      limitPrecision(programState.stakedIndexMesh.toNumber() / 1e9, 9),
      limitPrecision(this.stakedIndexMesh, 9),
      'mismatch stakedIndexMesh'
    );
  }

  public assertCollectedReward(txId: string, actualReward: number) {
    const cloneReward = this.collectedReward[txId];
    assert.equal(
      limitPrecision(actualReward / 1e9, 9),
      limitPrecision(cloneReward.meshReward + cloneReward.indexMeshReward, 9),
      'mismatch reward'
    );
  }

  public assertBalance(meshBalance: bigint, indexMeshBalance: bigint) {
    assert.equal(
      limitPrecision(Number(meshBalance.toString()) / 1e9, 9),
      limitPrecision(this.meshBalance - this.stakedMesh, 9),
      'mismatch user mesh balance'
    );

    assert.equal(
      limitPrecision(Number(indexMeshBalance.toString()) / 1e9, 9),
      limitPrecision(this.indexMeshBalance - this.stakedIndexMesh, 9),
      'mismatch user mesh balance'
    );
  }
}

function getReturnData(logs: string[]) {
  const prefix = 'Program return: ';
  let returnLog = logs.find(log => log.startsWith(prefix));
  returnLog = returnLog.slice(prefix.length);

  const [, data] = returnLog.split(' ', 2);
  return Buffer.from(data, 'base64');
}

class Assignable {
  constructor(properties) {
    Object.keys(properties).map(key => {
      this[key] = properties[key];
    });
  }
}

function decode_struct(returnType: any, fields: string[][], logs: string[]) {
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
