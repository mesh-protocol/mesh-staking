use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::GlobalState;

#[derive(Accounts)]
pub struct UpdatePeriodEnd<'info> {
    /// Only governance can execute and pay for the instruction.
    #[account(mut)]
    pub governance: Signer<'info>,

    /// Global state PDA to store the updated period_end_time.
    #[account(
        mut,
        seeds = [GlobalState::SEEDS],
        bump,
        has_one = governance @ ErrorCode::InvalidGovernance,
      )]
    pub global_state: Account<'info, GlobalState>,
}

pub fn update_period_end_handler(
    ctx: Context<UpdatePeriodEnd>,
    _distribution_time: u64
) -> Result<()> {
    if _distribution_time == 0 {
        return Err(ErrorCode::ZeroInput.into());
    }

    ctx.accounts.global_state.update_reward_per_share()?;

    let global_state = &mut ctx.accounts.global_state;

    global_state.period_end_time = global_state
        .get_current_time()?
        .checked_add(_distribution_time)
        .unwrap();

    Ok(())
}
