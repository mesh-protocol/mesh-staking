use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::GlobalState;

#[derive(Accounts)]
pub struct UpdateWeightage<'info> {
    /// Only governance can execute and pay for the instruction.
    #[account(mut)]
    pub governance: Signer<'info>,

    /// Global state PDA to store updated weightage.
    #[account(
        mut,
        seeds = [GlobalState::SEEDS],
        bump,
        has_one = governance @ ErrorCode::InvalidGovernance,
      )]
    pub global_state: Account<'info, GlobalState>,
}

pub fn update_weightage_handler(ctx: Context<UpdateWeightage>, _weightage: u64) -> Result<()> {
    ctx.accounts.global_state.update_reward_per_share()?;

    let global_state = &mut ctx.accounts.global_state;
    global_state.weightage = _weightage;

    Ok(())
}
