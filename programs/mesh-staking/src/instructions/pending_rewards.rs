use anchor_lang::prelude::*;

use crate::state::{ GlobalState, UserInfo, SCALE_FACTOR };

#[derive(Accounts)]
#[instruction(_user:Pubkey)]
pub struct PendingRewards<'info> {
    /// Global state PDA to read globally accumulated reward.
    #[account(seeds = [GlobalState::SEEDS], bump)]
    pub global_state: Account<'info, GlobalState>,

    /// User info PDA to read user accumulated reward.
    #[account(seeds = [_user.key().as_ref(), b"user_info"], bump)]
    pub user_info: Account<'info, UserInfo>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RewardStruct {
    pub mesh_reward: u64,
    pub index_mesh_reward: u64,
}

pub fn pending_rewards_handler(
    ctx: Context<PendingRewards>,
    _user: Pubkey
) -> Result<RewardStruct> {
    let user_info = &ctx.accounts.user_info;
    let global_state = &ctx.accounts.global_state;

    if user_info.staked_mesh == 0 && user_info.staked_index_mesh == 0 {
        return Ok(RewardStruct { mesh_reward: 0, index_mesh_reward: 0 });
    }

    let current_time: u64 = global_state.get_current_time()?;
    let [global_acc_reward_mesh, global_acc_reward_index_mesh] =
        global_state.calculate_reward_per_share(current_time)?;

    let mesh_reward = global_acc_reward_mesh
        .checked_sub(user_info.acc_reward_mesh)
        .unwrap()
        .checked_mul(GlobalState::to_u128(user_info.staked_mesh))
        .unwrap()
        .checked_div(SCALE_FACTOR)
        .unwrap();

    let index_mesh_reward = global_acc_reward_index_mesh
        .checked_sub(user_info.acc_reward_index_mesh)
        .unwrap()
        .checked_mul(GlobalState::to_u128(user_info.staked_index_mesh))
        .unwrap()
        .checked_div(SCALE_FACTOR)
        .unwrap();

    Ok(RewardStruct {
        mesh_reward: mesh_reward.try_into().unwrap(),
        index_mesh_reward: index_mesh_reward.try_into().unwrap(),
    })
}
