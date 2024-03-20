use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use crate::instructions::*;

declare_id!("HcgqAqH5MwpTACy2PXA91ecu98hr1Ewt7YAf5mHeT7zY");

#[program]
pub mod mesh_staking {
    use super::*;

    // Claim all pending rewards accumulated on $MESH & $indexMESH.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        claim_handler(ctx)
    }

    // Close UserInfo PDA, in-order to get the rent SOL back by the user.
    // Not closing by deafult in-order to maintain user claimed history for analytics.
    pub fn close_user_info(ctx: Context<CloseUserInfo>) -> Result<()> {
        close_user_info_handler(ctx)
    }

    // Initialize program by creating PDA's for global state & fund controller along with storing mint keys.
    // Only deployer instruction.
    pub fn initialize(
        ctx: Context<Initialize>,
        governance: Pubkey,
        mesh_mint: Pubkey,
        index_mesh_mint: Pubkey,
        weightage: u64
    ) -> Result<()> {
        initialize_handler(ctx, governance, mesh_mint, index_mesh_mint, weightage)
    }

    // Migrate reward SOL's to new version of staking program.
    // Only governance instruction.
    pub fn migrate_funds(ctx: Context<MigrateFunds>, amount: u64) -> Result<()> {
        migrate_funds_handler(ctx, amount)
    }

    // Readonly instrutcion for calculating pending rewards of a specific user.
    // The PDA's are not mutable in this instruction.
    pub fn pending_rewards(ctx: Context<PendingRewards>, user: Pubkey) -> Result<RewardStruct> {
        pending_rewards_handler(ctx, user)
    }

    // Stake user $MESH or $indexMESH, along with pending reward calculation and distribution.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        stake_handler(ctx, amount)
    }

    // Unstake user $MESH or $indexMESH, along with pending reward calculation and distribution.
    pub fn unstake(ctx: Context<Unstake>, amount: u64, is_emergency: bool) -> Result<()> {
        unstake_handler(ctx, amount, is_emergency)
    }

    // Update the governance pubkey in golbal state.
    // Only governance instruction.
    pub fn update_governance(ctx: Context<UpdateGovernance>, new_governance: Pubkey) -> Result<()> {
        update_governance_handler(ctx, new_governance)
    }

    // Update the reward period end state. Will be useful if need to distribute same reward for next cycle.
    // Only governance instruction.
    pub fn update_period_end(ctx: Context<UpdatePeriodEnd>, distribution_time: u64) -> Result<()> {
        update_period_end_handler(ctx, distribution_time)
    }

    // Update distribution rewards. Used to change rewards after rewards cycle ending or within same cycle.
    // Only governance instruction.
    pub fn update_rewards(
        ctx: Context<UpdateRewards>,
        reward: u64,
        distribution_time: u64
    ) -> Result<()> {
        update_rewards_handler(ctx, reward, distribution_time)
    }

    // Update the weightage of $indexMESH.
    // Only governance instruction.
    pub fn update_weightage(ctx: Context<UpdateWeightage>, weightage: u64) -> Result<()> {
        update_weightage_handler(ctx, weightage)
    }
}
