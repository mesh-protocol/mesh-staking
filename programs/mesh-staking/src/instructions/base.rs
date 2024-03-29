use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{ GlobalState, FundsController, UserInfo, SCALE_FACTOR };

/* Base instruction that will calculate user pending rewards and distribute SOLs 
according to it, on the action of Stake, Unstake, or Claim. */

#[derive(Accounts)]
pub struct Base<'info> {
    /// User that is performing the action.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Init userInfo PDA, if it's the first time stake by user, else just load mutably.
    #[account(
        init_if_needed,
        seeds = [user.key().as_ref(), b"user_info"],
        bump,
        payer = user,
        space = UserInfo::LEN
    )]
    pub user_info: Account<'info, UserInfo>,

    /// Update the global state of reward accumulation.
    #[account(
        mut,
        seeds = [GlobalState::SEEDS],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// Transfer reward SOLs to the user.
    #[account(
        mut,
        seeds = [FundsController::SEEDS],
        bump,
    )]
    pub funds_controller: Account<'info, FundsController>,

    /// The program used to create the userInfo state account.
    pub system_program: Program<'info, System>,
}

impl<'info> Base<'info> {
    /// Transer SOL from fund controller to user account.
    fn transfer_sol_to_user(&self, _amount: u64) -> Result<()> {
        **self.funds_controller.to_account_info().try_borrow_mut_lamports()? -= _amount;
        **self.user.to_account_info().try_borrow_mut_lamports()? += _amount;

        Ok(())
    }

    /// Check if fund controller has enough SOL after deducting the reward amount.
    pub fn not_have_enough_sol(&self, _amount_to_deduct: u64) -> Result<bool> {
        let controller_sol_balance = self.funds_controller
            .to_account_info()
            .lamports()
            .checked_sub(_amount_to_deduct)
            .unwrap();

        let controller_rent_exempt = Rent::get()?.minimum_balance(FundsController::LEN);

        Ok(controller_sol_balance <= controller_rent_exempt)
    }

    /// Calculate total pending rewards of the user, accumulated on their staked $MESH & $indexMESH.
    pub fn calculate_pending_rewards(&self) -> Result<u128> {
        let user_info = &self.user_info;
        let global_state = &self.global_state;

        let mesh_reward = global_state.global_acc_reward_mesh
            .checked_sub(user_info.acc_reward_mesh)
            .unwrap()
            .checked_mul(GlobalState::to_u128(user_info.staked_mesh))
            .unwrap()
            .checked_div(SCALE_FACTOR)
            .unwrap();

        let index_mesh_reward = global_state.global_acc_reward_index_mesh
            .checked_sub(user_info.acc_reward_index_mesh)
            .unwrap()
            .checked_mul(GlobalState::to_u128(user_info.staked_index_mesh))
            .unwrap()
            .checked_div(SCALE_FACTOR)
            .unwrap();

        let total_reward = mesh_reward.checked_add(index_mesh_reward).unwrap();

        Ok(total_reward)
    }

    /// Calculate pending reward, distribute it, and update the states.
    pub fn harvest_user_rewards(&mut self, _is_emergency: bool) -> Result<()> {
        let user_rewards: u64 = self.calculate_pending_rewards()?.try_into().unwrap();

        {
            let user_info = &mut self.user_info;
            user_info.acc_reward_mesh = self.global_state.global_acc_reward_mesh;
            user_info.acc_reward_index_mesh = self.global_state.global_acc_reward_index_mesh;
        }

        if !_is_emergency && user_rewards > 0 {
            if self.not_have_enough_sol(user_rewards)? {
                return Err(ErrorCode::InsufficientFunds.into());
            }

            self.transfer_sol_to_user(user_rewards)?;

            let user_info = &mut self.user_info;
            user_info.total_claimed_reward = user_info.total_claimed_reward
                .checked_add(user_rewards)
                .unwrap();
        }

        Ok(())
    }
}
