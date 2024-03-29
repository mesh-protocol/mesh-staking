use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, Token, TokenAccount, Transfer };

use super::base::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Stake<'info> {
    /// Base instruction for calculating & distributing user pending rewards.
    pub base: Base<'info>,

    /// Mint address of $MESH or $indexMESH.
    #[account(
        constraint = (mint.key() == base.global_state.mesh_mint || mint.key() == base.global_state.index_mesh_mint) @ ErrorCode::InvalidMint
    )]
    pub mint: Account<'info, Mint>,

    /// ATA of fundsConrtoller to hold mint.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = base.funds_controller
    )]
    pub mint_vault: Account<'info, TokenAccount>,

    /// ATA of user that is holding mint.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = base.user
    )]
    pub user_mint_token_account: Account<'info, TokenAccount>,

    /// The program used to transfer token from user ATA to vault.
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
}

impl<'info> Stake<'info> {
    /// Transfer $MESH or $indexMESH from user ATA to fundsController ATA.
    fn transfer_tokens_from_user_to_vault(&self, _amount: u64) -> Result<()> {
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), Transfer {
            from: self.user_mint_token_account.to_account_info(),
            to: self.mint_vault.to_account_info(),
            authority: self.base.user.to_account_info(),
        });
        token::transfer(cpi_ctx, _amount)
    }
}

pub fn stake_handler(ctx: Context<Stake>, _amount: u64) -> Result<()> {
    if _amount == 0 {
        return Err(ErrorCode::ZeroInput.into());
    }

    if ctx.accounts.base.global_state.reward == 0 {
        return Err(ErrorCode::RewardIsNotSet.into());
    }

    if
        ctx.accounts.base.global_state.period_end_time <=
        ctx.accounts.base.global_state.get_current_time()?
    {
        return Err(ErrorCode::RewardDistributionPeriodHasExpired.into());
    }

    if ctx.accounts.base.not_have_enough_sol(0)? {
        return Err(ErrorCode::InsufficientFunds.into());
    }

    ctx.accounts.base.user_info.init(ctx.accounts.base.user.key());

    ctx.accounts.transfer_tokens_from_user_to_vault(_amount)?;

    ctx.accounts.base.global_state.update_reward_per_share()?;
    ctx.accounts.base.harvest_user_rewards(false)?;

    let user_info = &mut ctx.accounts.base.user_info;
    let global_state = &mut ctx.accounts.base.global_state;

    if ctx.accounts.mint.key() == global_state.mesh_mint.key() {
        user_info.staked_mesh = user_info.staked_mesh.checked_add(_amount).unwrap();
        global_state.total_staked_mesh = global_state.total_staked_mesh
            .checked_add(_amount)
            .unwrap();
    } else {
        user_info.staked_index_mesh = user_info.staked_index_mesh.checked_add(_amount).unwrap();
        global_state.total_staked_index_mesh = global_state.total_staked_index_mesh
            .checked_add(_amount)
            .unwrap();
    }

    Ok(())
}
