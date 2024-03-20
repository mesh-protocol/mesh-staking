use anchor_lang::error_code;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount greater than staked amount")]
    AmountGreaterThanStakedAmount, // 6000
    #[msg("Insufficient funds")]
    InsufficientFunds, // 6001
    #[msg("Caller not deployer")]
    InvalidDeployer, // 6002
    #[msg("Caller not governance")]
    InvalidGovernance, // 6003
    #[msg("Invalid mint")]
    InvalidMint, // 6004
    #[msg("Reward distribution period has expired")]
    RewardDistributionPeriodHasExpired, // 6005
    #[msg("Reward is not set")]
    RewardIsNotSet, // 6006
    #[msg("User have staked amount")]
    StakedNotZero, // 6007
    #[msg("Zero Input")]
    ZeroInput, // 6008
}
