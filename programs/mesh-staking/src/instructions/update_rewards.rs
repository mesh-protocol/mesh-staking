use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::GlobalState;

#[derive(Accounts)]
pub struct UpdateRewards<'info> {
    /// Only governance can execute and pay for the instruction.
    #[account(mut)]
    pub governance: Signer<'info>,

    /// Global state PDA to store updated reward and distribution_time.
    #[account(
        mut,
        seeds = [GlobalState::SEEDS],
        bump,
        has_one = governance @ ErrorCode::InvalidGovernance,
      )]
    pub global_state: Account<'info, GlobalState>,
}

pub fn update_rewards_handler(
    ctx: Context<UpdateRewards>,
    _reward: u64,
    _distribution_time: u64
) -> Result<()> {
    if _distribution_time == 0 {
        return Err(ErrorCode::ZeroInput.into());
    }

    ctx.accounts.global_state.update_reward_per_share()?;

    let global_state = &mut ctx.accounts.global_state;

    let current_time = global_state.get_current_time()?;

    if current_time >= global_state.period_end_time {
        if _reward == 0 {
            return Err(ErrorCode::ZeroInput.into());
        }

        global_state.reward = _reward;
    } else {
        let remaining_reward = global_state.period_end_time
            .checked_sub(current_time)
            .unwrap()
            .checked_mul(global_state.reward)
            .unwrap()
            .checked_div(global_state.distribution_time)
            .unwrap();

        global_state.reward = _reward.checked_add(remaining_reward).unwrap();
    }

    global_state.distribution_time = _distribution_time;
    global_state.period_end_time = current_time.checked_add(_distribution_time).unwrap();
    global_state.total_distributed_reward = global_state.total_distributed_reward
        .checked_add(_reward)
        .unwrap();

    Ok(())
}
