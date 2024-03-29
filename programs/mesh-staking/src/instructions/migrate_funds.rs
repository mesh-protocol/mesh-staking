use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{ GlobalState, FundsController };

#[derive(Accounts)]
pub struct MigrateFunds<'info> {
    /// Only governance can execute and pay for the instruction.
    #[account(mut)]
    pub governance: Signer<'info>,

    /// CHECK: No check required for the new staking version account
    #[account(mut)]
    pub new_version: UncheckedAccount<'info>,

    /// Global state PDA.
    #[account(
        mut,
        seeds = [GlobalState::SEEDS],
        bump,
        has_one = governance @ ErrorCode::InvalidGovernance,
      )]
    pub global_state: Account<'info, GlobalState>,

    /// Transfer reward SOLs to new version.
    #[account(
        mut,
        seeds = [FundsController::SEEDS],
        bump,
    )]
    pub funds_controller: Account<'info, FundsController>,
}

impl<'info> MigrateFunds<'info> {
    /// Transfer SOLs from fundsController to new version of staking program.
    fn transfer_sol_from_reward_vault_to_new_version(&self, _amount: u64) -> Result<()> {
        **self.funds_controller.to_account_info().try_borrow_mut_lamports()? -= _amount;
        **self.new_version.to_account_info().try_borrow_mut_lamports()? += _amount;

        Ok(())
    }
}

pub fn migrate_funds_handler(ctx: Context<MigrateFunds>, _amount: u64) -> Result<()> {
    if _amount == 0 {
        return Err(ErrorCode::ZeroInput.into());
    }

    let controller_sol_balance = ctx.accounts.funds_controller
        .to_account_info()
        .lamports()
        .checked_sub(_amount)
        .unwrap();

    let controller_rent_exempt = Rent::get()?.minimum_balance(FundsController::LEN);

    if controller_sol_balance <= controller_rent_exempt {
        return Err(ErrorCode::InsufficientFunds.into());
    }

    ctx.accounts.transfer_sol_from_reward_vault_to_new_version(_amount)?;

    Ok(())
}
