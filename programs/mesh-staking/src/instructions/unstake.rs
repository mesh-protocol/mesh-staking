use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, Token, TokenAccount, Transfer };

use super::base::*;
use crate::errors::ErrorCode;
use crate::state::FundsController;

#[derive(Accounts)]
pub struct Unstake<'info> {
    /// Base instruction for calculating & distributing user pending rewards.
    pub base: Base<'info>,

    /// Mint address of $MESH or $indexMESH.
    #[account(
        constraint = (mint.key() == base.global_state.mesh_mint || mint.key() ==  base.global_state.index_mesh_mint) @ ErrorCode::InvalidMint
    )]
    pub mint: Account<'info, Mint>,

    /// ATA of fundsConrtoller that is holding mint.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = base.funds_controller
    )]
    pub mint_vault: Account<'info, TokenAccount>,

    /// ATA of user which will receive mint.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = base.user
    )]
    pub user_mint_token_account: Account<'info, TokenAccount>,

    /// The program used to transfer token from vault to user ATA.
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
}

impl<'info> Unstake<'info> {
    /// Transfer $MESH or $indexMESH from fundsController ATA to user ATA.
    fn transfer_tokens_from_vault_to_user(
        &self,
        _amount: u64,
        _funds_controller_bump: u8
    ) -> Result<()> {
        let signer: &[&[&[u8]]] = &[&[FundsController::SEEDS, &[_funds_controller_bump]]];

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: Transfer {
                from: self.mint_vault.to_account_info(),
                to: self.user_mint_token_account.to_account_info(),
                authority: self.base.funds_controller.to_account_info(),
            },
            remaining_accounts: Vec::new(),
            signer_seeds: signer,
        };
        token::transfer(cpi_ctx, _amount)
    }
}

pub fn unstake_handler(ctx: Context<Unstake>, _amount: u64, _is_emergency: bool) -> Result<()> {
    if _amount == 0 {
        return Err(ErrorCode::ZeroInput.into());
    }

    let base = &ctx.accounts.base;

    if
        ctx.accounts.mint.key() == base.global_state.mesh_mint.key() &&
        _amount > base.user_info.staked_mesh
    {
        return Err(ErrorCode::AmountGreaterThanStakedAmount.into());
    }

    if
        ctx.accounts.mint.key() == base.global_state.index_mesh_mint.key() &&
        _amount > base.user_info.staked_index_mesh
    {
        return Err(ErrorCode::AmountGreaterThanStakedAmount.into());
    }

    ctx.accounts.transfer_tokens_from_vault_to_user(_amount, ctx.bumps.base.funds_controller)?;

    ctx.accounts.base.global_state.update_reward_per_share()?;
    ctx.accounts.base.harvest_user_rewards(_is_emergency)?;

    let user_info = &mut ctx.accounts.base.user_info;
    let global_state = &mut ctx.accounts.base.global_state;

    if ctx.accounts.mint.key() == global_state.mesh_mint.key() {
        user_info.staked_mesh = user_info.staked_mesh.checked_sub(_amount).unwrap();
        global_state.total_staked_mesh = global_state.total_staked_mesh
            .checked_sub(_amount)
            .unwrap();
    } else {
        user_info.staked_index_mesh = user_info.staked_index_mesh.checked_sub(_amount).unwrap();
        global_state.total_staked_index_mesh = global_state.total_staked_index_mesh
            .checked_sub(_amount)
            .unwrap();
    }

    Ok(())
}
