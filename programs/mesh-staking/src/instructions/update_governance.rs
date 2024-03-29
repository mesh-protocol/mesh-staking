use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::GlobalState;

#[derive(Accounts)]
pub struct UpdateGovernance<'info> {
    /// Only governance can execute and pay for the instruction.
    #[account(mut)]
    pub governance: Signer<'info>,

    /// Global state PDA to store new governance.
    #[account(
      mut,
      seeds = [GlobalState::SEEDS],
      bump,
      has_one = governance @ ErrorCode::InvalidGovernance,
    )]
    pub global_state: Account<'info, GlobalState>,
}

pub fn update_governance_handler(
    ctx: Context<UpdateGovernance>,
    _new_governance: Pubkey
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    global_state.governance = _new_governance;
    Ok(())
}
