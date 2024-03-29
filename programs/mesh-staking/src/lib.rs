use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use crate::instructions::*;

declare_id!("HcgqAqH5MwpTACy2PXA91ecu98hr1Ewt7YAf5mHeT7zY");

#[program]
pub mod mesh_staking {
    use super::*;

    /// Claims all pending rewards accumulated on $MESH & $indexMESH.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        claim_handler(ctx)
    }

    /// Closes the UserInfo PDA in order to get the rent SOL back from the user.
    /// Not closing by default in order to maintain user claimed history for analytics.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    pub fn close_user_info(ctx: Context<CloseUserInfo>) -> Result<()> {
        close_user_info_handler(ctx)
    }

    /// Initializes the program by creating PDAs for global state & fund controller along with storing mint keys.
    /// Only deployer instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `governance` - Pubkey responsible for executing governance-only instructions.
    /// * `mesh_mint` - Pubkey of the $MESH SPL token.
    /// * `index_mesh_mint` - Pubkey of the $indexMESH SPL token.
    /// * `weightage` - Weight of $indexMESH used for its reward calculation.
    pub fn initialize(
        ctx: Context<Initialize>,
        governance: Pubkey,
        mesh_mint: Pubkey,
        index_mesh_mint: Pubkey,
        weightage: u64
    ) -> Result<()> {
        initialize_handler(ctx, governance, mesh_mint, index_mesh_mint, weightage)
    }

    /// Migrates reward SOLs to the new version of the staking program.
    /// Only governance instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `amount` - The amount of SOL to be migrated.
    pub fn migrate_funds(ctx: Context<MigrateFunds>, amount: u64) -> Result<()> {
        migrate_funds_handler(ctx, amount)
    }

    /// Readonly instruction for calculating pending rewards of a specific user.
    /// The PDAs are not mutable in this instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `user` - The user for which pending rewards are fetched.
    pub fn pending_rewards(ctx: Context<PendingRewards>, user: Pubkey) -> Result<RewardStruct> {
        pending_rewards_handler(ctx, user)
    }

    /// Stakes user $MESH or $indexMESH tokens, along with pending reward calculation and distribution.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `amount` - The amount of tokens the user wants to stake.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        stake_handler(ctx, amount)
    }

    /// Unstakes user $MESH or $indexMESH tokens, along with pending reward calculation and distribution.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `amount` - The amount of tokens the user wants to unstake.
    /// * `is_emergency` - A boolean flag indicating whether to disable fees and only unstake in case of emergency.
    pub fn unstake(ctx: Context<Unstake>, amount: u64, is_emergency: bool) -> Result<()> {
        unstake_handler(ctx, amount, is_emergency)
    }

    /// Updates the governance pubkey.
    /// Only governance instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `new_governance` - Pubkey of the new governance account.
    pub fn update_governance(ctx: Context<UpdateGovernance>, new_governance: Pubkey) -> Result<()> {
        update_governance_handler(ctx, new_governance)
    }

    /// Updates the reward period end state. Useful if there's a need to distribute the same reward for the next cycle.
    /// Only governance instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `distribution_time` - The new duration up to which the reward will be distributed.
    pub fn update_period_end(ctx: Context<UpdatePeriodEnd>, distribution_time: u64) -> Result<()> {
        update_period_end_handler(ctx, distribution_time)
    }

    /// Updates distribution rewards. Used to change rewards after the rewards cycle ending or within the same cycle.
    /// Only governance instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `reward` - The amount of SOL to be distributed.
    /// * `distribution_time` - The duration up to which the reward will be distributed.
    pub fn update_rewards(
        ctx: Context<UpdateRewards>,
        reward: u64,
        distribution_time: u64
    ) -> Result<()> {
        update_rewards_handler(ctx, reward, distribution_time)
    }

    /// Updates the weightage of $indexMESH for reward calculation.
    /// Only governance instruction.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The accounts required by the instruction.
    /// * `weightage` - The new weightage of $indexMESH for reward calculation.
    pub fn update_weightage(ctx: Context<UpdateWeightage>, weightage: u64) -> Result<()> {
        update_weightage_handler(ctx, weightage)
    }
}
