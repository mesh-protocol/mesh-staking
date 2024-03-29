use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{ GlobalState, FundsController, DEPLOYER };

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Only deployer can invoke the init and pay rent for it.
    #[account(mut, address = DEPLOYER @ ErrorCode::InvalidDeployer)]
    pub payer: Signer<'info>,

    /// PDA to store global_state
    #[account(init, seeds = [GlobalState::SEEDS], bump, payer = payer, space = GlobalState::LEN)]
    pub global_state: Account<'info, GlobalState>,

    /// PDA to control funds
    #[account(
        init,
        seeds = [FundsController::SEEDS],
        bump,
        payer = payer,
        space = FundsController::LEN
    )]
    pub funds_controller: Account<'info, FundsController>,

    /// The program used to create global_state & funds_controller PDA.
    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(
    ctx: Context<Initialize>,
    _governance: Pubkey,
    _mesh_mint: Pubkey,
    _index_mesh_mint: Pubkey,
    _weightage: u64
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    global_state.governance = _governance;
    global_state.mesh_mint = _mesh_mint;
    global_state.index_mesh_mint = _index_mesh_mint;
    global_state.weightage = _weightage;
    Ok(())
}
