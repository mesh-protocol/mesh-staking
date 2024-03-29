use anchor_lang::prelude::*;

use super::base::*;

#[derive(Accounts)]
pub struct Claim<'info> {
    /// Base instruction for calculating & distributing user pending rewards.
    pub base: Base<'info>,
}

pub fn claim_handler(ctx: Context<Claim>) -> Result<()> {
    ctx.accounts.base.global_state.update_reward_per_share()?;
    ctx.accounts.base.harvest_user_rewards(false)?;
    Ok(())
}
