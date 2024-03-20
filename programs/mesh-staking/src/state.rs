use std::primitive;

use anchor_lang::prelude::*;
use solana_program::{ pubkey, pubkey::Pubkey };

pub const SACLE_FACTOR_BASE: u128 = 1_000_000_000;
pub const SCALE_FACTOR: u128 = 1_000_000_000_000_000_000;
// Pubkey that will deploy and initialize the program
pub const DEPLOYER: Pubkey = pubkey!("8SstKb2ugTF6D6RdDAFgnzPE4gHytTirGHJ8t7phdLS2");

// PDA to store globally used state
#[account]
pub struct GlobalState {
    // Pubkey which will be responsible for executing governance only instructions.
    pub governance: Pubkey,
    // Pubkey of $MESH SPL token
    pub mesh_mint: Pubkey,
    // Pubkey of $indexMESH SPL token
    pub index_mesh_mint: Pubkey,
    // Amount of SOL that will be distributed in current cycle.
    pub reward: u64,
    // Timeframe of current cycle in seconds.
    pub distribution_time: u64,
    // Global state for maintaing reward calculation on per unit of $MESH.
    pub global_acc_reward_mesh: u128,
    // Global state for maintaing reward calculation on per unit of $indexMESH.
    pub global_acc_reward_index_mesh: u128,
    // Total amount of $MESH staked by users.
    pub total_staked_mesh: u64,
    // Total amount of $indexMESH staked by users.
    pub total_staked_index_mesh: u64,
    // Weight of $indexMESH which will be used for it's reward calculation.
    // Note: the weightage is in ($MESH/$indexMESH), eg: 0.5 means 0.5 $MESH is equivalent to 1 $indexMESH
    pub weightage: u64,
    // Unix timestamp in which last time reward was calculated.
    pub last_updated_time: u64,
    // Unix timestamp in which the current reward distribution cycle will ends.
    pub period_end_time: u64,
    // The sum of total SOL's that has been distributed as a reward uptill now.
    pub total_distributed_reward: u64,
}

impl GlobalState {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 16 + 16 + 8 + 8 + 8 + 8 + 8 + 8;
    pub const SEEDS: &'static [u8] = b"global_state";

    // Typecast u64 to u128. Inorder to avoid overflow on u64 variables.
    pub fn to_u128(_value: u64) -> u128 {
        primitive::u128::from(_value)
    }

    // Current unix timestamp, tyecasted for i64 to u64.
    pub fn get_current_time(&self) -> Result<u64> {
        Ok(Clock::get()?.unix_timestamp.try_into().unwrap())
    }

    // Valid timestamp uptill which reward can be distributed.
    /* Checks if the reward cycle is ended and the reward calculation is invoked after than
    return the end time instead of current time. In-order to avoid extra reward accumulation. */
    pub fn get_last_reward_time(&self, _current_time: u64) -> u64 {
        if _current_time < self.period_end_time {
            return _current_time;
        }

        self.period_end_time
    }

    // The count of seconds in which the reward will be accumulated.
    pub fn get_reward_time(&self, _current_time: u64) -> u64 {
        self.get_last_reward_time(_current_time).checked_sub(self.last_updated_time).unwrap()
    }

    // Calculate the new accumulated reward on $MESH & $indexMESH, and sum it with previously accumulated reward.
    pub fn calculate_reward_per_share(&self, _current_time: u64) -> Result<[u128; 2]> {
        let reward = GlobalState::to_u128(self.get_reward_time(_current_time))
            .checked_mul(GlobalState::to_u128(self.reward))
            .unwrap();

        let weighted_index_mesh = GlobalState::to_u128(self.total_staked_index_mesh)
            .checked_mul(GlobalState::to_u128(self.weightage))
            .unwrap()
            .checked_div(SACLE_FACTOR_BASE)
            .unwrap();

        let total_weighted_amount = weighted_index_mesh
            .checked_add(GlobalState::to_u128(self.total_staked_mesh))
            .unwrap();

        let acc_reward = reward
            .checked_mul(SCALE_FACTOR)
            .unwrap()
            .checked_div(GlobalState::to_u128(self.distribution_time))
            .unwrap()
            .checked_div(total_weighted_amount)
            .unwrap();

        let acc_reward_index_mesh = acc_reward
            .checked_mul(GlobalState::to_u128(self.weightage))
            .unwrap()
            .checked_div(SACLE_FACTOR_BASE)
            .unwrap();

        Ok([
            self.global_acc_reward_mesh.checked_add(acc_reward).unwrap(),
            self.global_acc_reward_index_mesh.checked_add(acc_reward_index_mesh).unwrap(),
        ])
    }

    // Update the global state of reward accumulated on per unit of $MESH & $indexMESH.
    pub fn update_reward_per_share(&mut self) -> Result<()> {
        let current_time: u64 = self.get_current_time()?;

        if current_time <= self.last_updated_time {
            return Ok(());
        }

        if self.total_staked_mesh == 0 && self.total_staked_index_mesh == 0 {
            self.last_updated_time = self.get_last_reward_time(current_time);
            return Ok(());
        }

        let [global_acc_reward_mesh, global_acc_reward_index_mesh] =
            self.calculate_reward_per_share(current_time)?;

        self.global_acc_reward_mesh = global_acc_reward_mesh;
        self.global_acc_reward_index_mesh = global_acc_reward_index_mesh;
        self.last_updated_time = self.get_last_reward_time(current_time);

        Ok(())
    }
}

// PDA to store user specific state
#[account]
pub struct UserInfo {
    // Pubkey of user
    pub user: Pubkey,
    // User state for maintaing reward calculation on per unit of $MESH.
    /* It helps to findout how much user share have in the globally accumulated reward. 
       And how much of them is still unclaimed.  */
    pub acc_reward_mesh: u128,
    // User state for maintaing reward calculation on per unit of $indexMESH.
    pub acc_reward_index_mesh: u128,
    // Amount of $MESH staked by user.
    pub staked_mesh: u64,
    // Amount of $indexMESH staked by user.
    pub staked_index_mesh: u64,
    // The sum of total reward SOL's that has been claimed by user uptill now.
    pub total_claimed_reward: u64,
}

impl UserInfo {
    pub const LEN: usize = 8 + 32 + 16 + 16 + 8 + 8 + 8;

    // Check if user PDA is initialized or not
    pub fn is_initialized(&self) -> bool {
        self.user != Pubkey::default()
    }

    // Initialize PDA by storing user Pubkey.
    pub fn init(&mut self, user: Pubkey) -> () {
        if !self.is_initialized() {
            self.user = user;
        }
    }
}

// PDA to hold the ownership of reward SOL's, staked $MESH & $indexMESH
#[account]
pub struct FundsController {}

impl FundsController {
    pub const LEN: usize = 8 + 0;
    pub const SEEDS: &'static [u8] = b"funds_controller";
}
