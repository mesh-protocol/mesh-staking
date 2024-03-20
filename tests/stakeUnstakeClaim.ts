import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  getAccount,
  createAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { assert } from 'chai';

import { governanceKeypair, meshMint, indexMeshMint, userOne, userTwo } from './hooks';
import { delay } from '../utils';
import { parseUnits, limitPrecision } from '../utils/formatting';
import { GlobalStateClone, UserClone } from '../utils/state';
import { airdropSol, getConfirmedTransaction } from '../utils/web3';
import { MeshStaking } from '../target/types/mesh_staking';

describe('stake / unstake / claim', () => {
  const program = anchor.workspace.MeshStaking as Program<MeshStaking>;

  const connection = anchor.getProvider().connection;

  const meshMintAmount = 3000000;
  const indexMeshMintAmount = 2000000;

  //global
  const gsClone = new GlobalStateClone();
  gsClone.distributionTime = 30 * 24 * 60 * 60;
  gsClone.reward = 10;
  gsClone.weightage = 0.5;

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

  //userOne
  let user01Clone = new UserClone(userOne.publicKey, gsClone);
  user01Clone.meshBalance = meshMintAmount;
  user01Clone.indexMeshBalance = indexMeshMintAmount;

  const [userOneInfo] = anchor.web3.PublicKey.findProgramAddressSync(
    [userOne.publicKey.toBuffer(), Buffer.from('user_info')],
    program.programId
  );

  const userOneMeshATA = getAssociatedTokenAddressSync(
    meshMint,
    userOne.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  const userOneIndexMeshATA = getAssociatedTokenAddressSync(
    indexMeshMint,
    userOne.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  //userTwo
  let user02Clone = new UserClone(userTwo.publicKey, gsClone);
  user02Clone.meshBalance = meshMintAmount;
  user02Clone.indexMeshBalance = indexMeshMintAmount;

  const [userTwoInfo] = anchor.web3.PublicKey.findProgramAddressSync(
    [userTwo.publicKey.toBuffer(), Buffer.from('user_info')],
    program.programId
  );

  const userTwoMeshATA = getAssociatedTokenAddressSync(
    meshMint,
    userTwo.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  const userTwoIndexMeshATA = getAssociatedTokenAddressSync(
    indexMeshMint,
    userTwo.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  before(async () => {
    const _meshMintAmount = parseUnits(meshMintAmount).toNumber();
    const _indexMeshMintAmount = parseUnits(indexMeshMintAmount).toNumber();

    await airdropSol(connection, fundsController, 10);

    await Promise.all([
      createAssociatedTokenAccount(connection, governanceKeypair, meshMint, userOne.publicKey),
      createAssociatedTokenAccount(connection, governanceKeypair, indexMeshMint, userOne.publicKey),
      createAssociatedTokenAccount(connection, governanceKeypair, meshMint, userTwo.publicKey),
      createAssociatedTokenAccount(connection, governanceKeypair, indexMeshMint, userTwo.publicKey),
    ]);

    await Promise.all([
      mintTo(
        connection,
        governanceKeypair,
        meshMint,
        userOneMeshATA,
        governanceKeypair,
        _meshMintAmount
      ),
      mintTo(
        connection,
        governanceKeypair,
        indexMeshMint,
        userOneIndexMeshATA,
        governanceKeypair,
        _indexMeshMintAmount
      ),
      mintTo(
        connection,
        governanceKeypair,
        meshMint,
        userTwoMeshATA,
        governanceKeypair,
        _meshMintAmount
      ),
      mintTo(
        connection,
        governanceKeypair,
        indexMeshMint,
        userTwoIndexMeshATA,
        governanceKeypair,
        _indexMeshMintAmount
      ),
    ]);
  });

  it('stake 10 mesh by userOne', async () => {
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const stakeAmount = 10;

    let txId = await program.methods
      .stake(parseUnits(stakeAmount))
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: meshMint,
        mintVault: meshVault,
        userMintTokenAccount: userOneMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userOne])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userOneMeshATA),
      getAccount(connection, userOneIndexMeshATA),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    gsClone.lastUpdated = gs.lastUpdatedTime.toNumber();
    user01Clone.stakeMesh(txId, tx.blockTime, stakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user01Clone.assertState({ ...ui });
    user01Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    // user01Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);
  });

  it('stake 5 mesh by userOne', async () => {
    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const stakeAmount = 5;

    const txId = await program.methods
      .stake(parseUnits(stakeAmount))
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: meshMint,
        mintVault: meshVault,
        userMintTokenAccount: userOneMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userOne])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userOneMeshATA),
      getAccount(connection, userOneIndexMeshATA),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user01Clone.stakeMesh(txId, tx.blockTime, stakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user01Clone.assertState({ ...ui });
    user01Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    user01Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);
  });

  it('unstake 5 mesh by userOne', async () => {
    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const unstakeAmount = 5;

    const txId = await program.methods
      .unstake(parseUnits(unstakeAmount), false)
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: meshMint,
        mintVault: meshVault,
        userMintTokenAccount: userOneMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userOne])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userOneMeshATA),
      getAccount(connection, userOneIndexMeshATA),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user01Clone.unstakeMesh(txId, tx.blockTime, unstakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user01Clone.assertState({ ...ui });
    user01Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    user01Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);
  });

  it('stake 20 indexMesh by userOne', async () => {
    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const stakeAmount = 20;

    const txId = await program.methods
      .stake(parseUnits(stakeAmount))
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: indexMeshMint,
        mintVault: indexMeshVault,
        userMintTokenAccount: userOneIndexMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userOne])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userOneMeshATA),
      getAccount(connection, userOneIndexMeshATA),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user01Clone.stakeIndexMesh(txId, tx.blockTime, stakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user01Clone.assertState({ ...ui });
    user01Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    user01Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);
  });

  it('unstake 10 indexMesh by userOne', async () => {
    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const unstakeAmount = 10;

    const txId = await program.methods
      .unstake(parseUnits(unstakeAmount), false)
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: indexMeshMint,
        mintVault: indexMeshVault,
        userMintTokenAccount: userOneIndexMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userOne])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userOneMeshATA),
      getAccount(connection, userOneIndexMeshATA),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user01Clone.unstakeIndexMesh(txId, tx.blockTime, unstakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user01Clone.assertState({ ...ui });
    user01Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    user01Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);

    const userRewards = user01Clone.collectedReward[txId];
    assert.equal(userRewards.meshReward, userRewards.indexMeshReward, 'userOne rewards diff');
  });

  it('stake 30 indexMesh by userTwo', async () => {
    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userTwo.publicKey);

    const stakeAmount = 30;

    const txId = await program.methods
      .stake(parseUnits(stakeAmount))
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userTwo.publicKey,
          userInfo: userTwoInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: indexMeshMint,
        mintVault: indexMeshVault,
        userMintTokenAccount: userTwoIndexMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userTwo])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userTwoInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userTwoMeshATA),
      getAccount(connection, userTwoIndexMeshATA),
      connection.getBalance(userTwo.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user02Clone.stakeIndexMesh(txId, tx.blockTime, stakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user02Clone.assertState({ ...ui });
    user02Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    // user02Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);
  });

  it('claim rewards by userOne', async () => {
    const user01Reward = user01Clone.pendingRewards();
    let user01RewardUptoUser02Entry = user01Reward.meshReward + user01Reward.indexMeshReward;
    user01RewardUptoUser02Entry = parseFloat(limitPrecision(user01RewardUptoUser02Entry, 9));

    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const txId = await program.methods
      .claim()
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      })
      .signers([userOne])
      .rpc();

    const [gs, ui, userNewSOLBal] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user01Clone.claim(txId, tx.blockTime);

    gsClone.assertState({ ...gs });
    user01Clone.assertState({ ...ui });
    user01Clone.assertCollectedReward(txId, userNewSOLBal - userPrevSOLBal);

    const { meshReward, indexMeshReward } = user02Clone.pendingRewards();

    assert.equal(
      limitPrecision((userNewSOLBal - userPrevSOLBal) / 1e9 - user01RewardUptoUser02Entry, 9),
      limitPrecision(meshReward + indexMeshReward, 9),
      'userOne and userTwo reward diff'
    );
  });

  it('untsake all mesh and close account by userTwo', async () => {
    const stakeAmount = 30;

    const txId = await program.methods
      .unstake(parseUnits(stakeAmount), false)
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userTwo.publicKey,
          userInfo: userTwoInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: indexMeshMint,
        mintVault: indexMeshVault,
        userMintTokenAccount: userTwoIndexMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userTwo])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userTwoInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userTwoMeshATA),
      getAccount(connection, userTwoIndexMeshATA),
      connection.getBalance(userTwo.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user02Clone.unstakeIndexMesh(txId, tx.blockTime, stakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user02Clone.assertState({ ...ui });
    user02Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);

    await program.methods
      .closeUserInfo()
      .accounts({ user: userTwo.publicKey, userInfo: userTwoInfo })
      .signers([userTwo])
      .rpc();

    //no PDA found becuase userInfo pda is closed on all unstake
    try {
      await program.account.userInfo.fetch(userTwoInfo);
    } catch (error) {
      const errMsg = `Account does not exist or has no data ${userTwoInfo.toBase58()}`;
      assert.equal(error.message, errMsg);
    }
  });

  it('emergency unstake 10 indexMesh by userTwo', async () => {
    await delay(5 * 1000);
    const userPrevSOLBal = await connection.getBalance(userOne.publicKey);

    const unstakeAmount = 10;

    const txId = await program.methods
      .unstake(parseUnits(unstakeAmount), true)
      .accounts({
        base: {
          fundsController,
          globalState,
          user: userOne.publicKey,
          userInfo: userOneInfo,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        mint: indexMeshMint,
        mintVault: indexMeshVault,
        userMintTokenAccount: userOneIndexMeshATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userOne])
      .rpc();

    const [
      gs,
      ui,
      meshAccount,
      indexMeshAccount,
      userMeshAccount,
      userIndexMeshAccount,
      userNewSOLBal,
    ] = await Promise.all([
      program.account.globalState.fetch(globalState),
      program.account.userInfo.fetch(userOneInfo),
      getAccount(connection, meshVault),
      getAccount(connection, indexMeshVault),
      getAccount(connection, userOneMeshATA),
      getAccount(connection, userOneIndexMeshATA),
      connection.getBalance(userOne.publicKey),
    ]);

    const tx = await getConfirmedTransaction(connection, txId);

    user01Clone.unstakeIndexMesh(txId, tx.blockTime, unstakeAmount);

    gsClone.assertState({ ...gs });
    gsClone.assertBalance(meshAccount.amount, indexMeshAccount.amount);

    user01Clone.assertState({ ...ui });
    user01Clone.assertBalance(userMeshAccount.amount, userIndexMeshAccount.amount);
    assert.equal(userNewSOLBal - userPrevSOLBal, 0);
  });
});
