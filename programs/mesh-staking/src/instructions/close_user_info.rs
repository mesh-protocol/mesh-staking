use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::UserInfo;

#[derive(Accounts)]
pub struct CloseUserInfo<'info> {
    /// User who had paid for userInfo PDA.
    #[account(mut)]
    pub user: Signer<'info>,

    /// UserInfo PDA that has to be closed.
    #[account(
        mut,
        seeds = [user.key().as_ref(), b"user_info"],
        bump,
    )]
    pub user_info: Account<'info, UserInfo>,
}

pub fn close_user_info_handler(ctx: Context<CloseUserInfo>) -> Result<()> {
    let user_info = &mut ctx.accounts.user_info;

    // Not allowed to close PDA if the user still has some staked $MESH or $indexMESH.
    if user_info.staked_mesh != 0 || user_info.staked_index_mesh != 0 {
        return Err(ErrorCode::StakedNotZero.into());
    }

    let amount = **user_info.to_account_info().try_borrow_mut_lamports()?;
    **user_info.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;

    Ok(())
}
