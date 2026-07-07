//! AgentVault: an on-chain spending-policy guard for autonomous agents.
//!
//! An owner registers a scoped spending policy for each agent `Address`. The
//! policy fixes the maximum amount per transaction, a rolling daily cap, the
//! only address the agent may pay, an expiry, and a required purpose hash. The
//! agent then calls `agent_pay`, which is accepted only when the requested
//! payment satisfies every clause of the policy, in order. Any rejection
//! reverts with a typed error; every accepted payment emits a `PaymentExecuted`
//! event and advances the agent's per-day spent counter.

use odra::casper_types::U512;
use odra::prelude::*;

/// A per-agent spending policy stored in the vault.
///
/// Structs used inside `Mapping` values (or returned from entrypoints) must be
/// annotated with `#[odra::odra_type]` so Odra can (de)serialize them.
#[odra::odra_type]
pub struct Policy {
    /// Maximum amount (in motes) the agent may move in a single `agent_pay` call.
    pub max_per_tx: U512,
    /// Maximum cumulative amount the agent may move within a single day.
    pub daily_cap: U512,
    /// The only target address the agent is allowed to pay.
    pub allowed_target: Address,
    /// Unix/block time in milliseconds after which the policy is no longer valid.
    pub expiry: u64,
    /// The purpose hash the agent must supply with every payment under this policy.
    pub purpose_hash: String,
    /// When true the policy is disabled regardless of the other fields.
    pub revoked: bool,
}

/// Errors returned to callers. Field-less enum with explicit discriminants so the
/// on-chain error codes are stable across builds.
#[odra::odra_error]
pub enum Error {
    /// A non-owner tried to call an owner-only entrypoint.
    NotOwner = 1,
    /// The calling agent has no registered policy.
    NoPolicy = 2,
    /// The policy has been revoked by the owner.
    Revoked = 3,
    /// The current block time is past the policy expiry.
    Expired = 4,
    /// The requested target does not match the policy's allowed target.
    WrongTarget = 5,
    /// The supplied purpose hash does not match the policy's purpose hash.
    WrongPurpose = 6,
    /// The requested amount exceeds the policy's per-transaction limit.
    AmountExceedsLimit = 7,
    /// The requested amount would push the agent's spend for the day over the cap.
    DailyCapExceeded = 8,
}

/// Emitted when the owner registers or updates a policy.
#[odra::event]
pub struct PolicySet {
    pub agent: Address,
    pub max_per_tx: U512,
    pub daily_cap: U512,
    pub allowed_target: Address,
    pub expiry: u64,
}

/// Emitted when the owner revokes a policy.
#[odra::event]
pub struct PolicyRevoked {
    pub agent: Address,
}

/// Emitted when an agent successfully executes an in-policy payment.
#[odra::event]
pub struct PaymentExecuted {
    pub agent: Address,
    pub target: Address,
    pub amount: U512,
    pub purpose_hash: String,
}

/// Number of milliseconds in a day. Used to bucket the per-agent spend counter.
const MS_PER_DAY: u64 = 86_400_000;

/// The AgentVault contract module.
#[odra::module(
    events = [PolicySet, PolicyRevoked, PaymentExecuted],
    errors = Error
)]
pub struct AgentVault {
    owner: Var<Address>,
    policies: Mapping<Address, Policy>,
    // key: (agent, day) where day = block_time / MS_PER_DAY
    spent: Mapping<(Address, u64), U512>,
}

#[odra::module]
impl AgentVault {
    /// Initializes the vault with the deployer as the owner.
    pub fn init(&mut self) {
        self.owner.set(self.env().caller());
    }

    /// Registers or replaces the policy for `agent`. Owner only.
    pub fn set_policy(
        &mut self,
        agent: Address,
        max_per_tx: U512,
        daily_cap: U512,
        allowed_target: Address,
        expiry: u64,
        purpose_hash: String,
    ) {
        self.assert_owner();
        self.policies.set(
            &agent,
            Policy {
                max_per_tx,
                daily_cap,
                allowed_target,
                expiry,
                purpose_hash,
                revoked: false,
            },
        );
        self.env().emit_event(PolicySet {
            agent,
            max_per_tx,
            daily_cap,
            allowed_target,
            expiry,
        });
    }

    /// Revokes the policy for `agent`. Owner only.
    pub fn revoke_policy(&mut self, agent: Address) {
        self.assert_owner();
        let mut policy = self.load_policy(&agent);
        policy.revoked = true;
        self.policies.set(&agent, policy);
        self.env().emit_event(PolicyRevoked { agent });
    }

    /// Called by an agent to pay `target`. Reverts unless the payment is within
    /// the agent's registered, active, unexpired policy and stays under both the
    /// per-transaction limit and the rolling daily cap.
    pub fn agent_pay(&mut self, target: Address, amount: U512, purpose_hash: String) {
        let agent = self.env().caller();
        let policy = self.load_policy(&agent);

        if policy.revoked {
            self.env().revert(Error::Revoked);
        }
        if self.env().get_block_time() > policy.expiry {
            self.env().revert(Error::Expired);
        }
        if target != policy.allowed_target {
            self.env().revert(Error::WrongTarget);
        }
        if purpose_hash != policy.purpose_hash {
            self.env().revert(Error::WrongPurpose);
        }
        if amount > policy.max_per_tx {
            self.env().revert(Error::AmountExceedsLimit);
        }

        let day = self.env().get_block_time() / MS_PER_DAY;
        let spent_today = self.spent.get(&(agent, day)).unwrap_or_default();
        let new_spent = spent_today + amount;
        if new_spent > policy.daily_cap {
            self.env().revert(Error::DailyCapExceeded);
        }
        self.spent.set(&(agent, day), new_spent);

        self.env().emit_event(PaymentExecuted {
            agent,
            target,
            amount,
            purpose_hash,
        });
    }

    /// Returns the current owner.
    pub fn get_owner(&self) -> Address {
        self.owner.get_or_revert_with(Error::NotOwner)
    }

    /// Returns the policy for `agent`, or `None` if no policy has been registered.
    pub fn get_policy(&self, agent: Address) -> Option<Policy> {
        self.policies.get(&agent)
    }

    /// Returns the amount `agent` has already spent in the current day's bucket.
    pub fn get_spent_today(&self, agent: Address) -> U512 {
        let day = self.env().get_block_time() / MS_PER_DAY;
        self.spent.get(&(agent, day)).unwrap_or_default()
    }

    fn assert_owner(&self) {
        if self.env().caller() != self.owner.get_or_revert_with(Error::NotOwner) {
            self.env().revert(Error::NotOwner);
        }
    }

    fn load_policy(&self, agent: &Address) -> Policy {
        self.policies
            .get(agent)
            .unwrap_or_revert_with(&self.env(), Error::NoPolicy)
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentVault, AgentVaultHostRef, Error, PaymentExecuted};
    use odra::casper_types::U512;
    use odra::host::{Deployer, NoArgs};
    use odra::prelude::Address;

    const PURPOSE: &str = "invoice-abc123";

    fn setup() -> (odra::host::HostEnv, AgentVaultHostRef) {
        let env = odra_test::env();
        // Account 0 is the deployer/owner.
        env.set_caller(env.get_account(0));
        let contract = AgentVault::deploy(&env, NoArgs);
        (env, contract)
    }

    fn set_default_policy(
        env: &odra::host::HostEnv,
        contract: &mut AgentVaultHostRef,
        agent: Address,
        target: Address,
        max_per_tx: u64,
        daily_cap: u64,
        expiry: u64,
    ) {
        env.set_caller(env.get_account(0));
        contract.set_policy(
            agent,
            U512::from(max_per_tx),
            U512::from(daily_cap),
            target,
            expiry,
            PURPOSE.to_string(),
        );
    }

    #[test]
    fn owner_is_deployer() {
        let (env, contract) = setup();
        assert_eq!(contract.get_owner(), env.get_account(0));
    }

    #[test]
    fn success_path_emits_event() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        set_default_policy(&env, &mut contract, agent, target, 1_000, 5_000, u64::MAX);

        env.set_caller(agent);
        contract.agent_pay(target, U512::from(500u64), PURPOSE.to_string());

        assert!(env.emitted_event(
            &contract,
            PaymentExecuted {
                agent,
                target,
                amount: U512::from(500u64),
                purpose_hash: PURPOSE.to_string(),
            }
        ));
        assert_eq!(contract.get_spent_today(agent), U512::from(500u64));
    }

    #[test]
    fn non_owner_cannot_set_policy() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        env.set_caller(agent);
        assert_eq!(
            contract.try_set_policy(
                agent,
                U512::from(1_000u64),
                U512::from(5_000u64),
                target,
                u64::MAX,
                PURPOSE.to_string(),
            ),
            Err(Error::NotOwner.into())
        );
    }

    #[test]
    fn reverts_without_policy() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        env.set_caller(agent);
        assert_eq!(
            contract.try_agent_pay(target, U512::from(1u64), PURPOSE.to_string()),
            Err(Error::NoPolicy.into())
        );
    }

    #[test]
    fn reverts_when_revoked() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        set_default_policy(&env, &mut contract, agent, target, 1_000, 5_000, u64::MAX);
        env.set_caller(env.get_account(0));
        contract.revoke_policy(agent);

        env.set_caller(agent);
        assert_eq!(
            contract.try_agent_pay(target, U512::from(10u64), PURPOSE.to_string()),
            Err(Error::Revoked.into())
        );
    }

    #[test]
    fn reverts_when_expired() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        // Policy expires at block time 1000 ms.
        set_default_policy(&env, &mut contract, agent, target, 1_000, 5_000, 1_000u64);

        // Advance block time past expiry.
        env.advance_block_time(2_000u64);

        env.set_caller(agent);
        assert_eq!(
            contract.try_agent_pay(target, U512::from(10u64), PURPOSE.to_string()),
            Err(Error::Expired.into())
        );
    }

    #[test]
    fn reverts_on_wrong_target() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);
        let wrong_target = env.get_account(3);

        set_default_policy(&env, &mut contract, agent, target, 1_000, 5_000, u64::MAX);

        env.set_caller(agent);
        assert_eq!(
            contract.try_agent_pay(wrong_target, U512::from(10u64), PURPOSE.to_string()),
            Err(Error::WrongTarget.into())
        );
    }

    #[test]
    fn reverts_on_wrong_purpose() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        set_default_policy(&env, &mut contract, agent, target, 1_000, 5_000, u64::MAX);

        env.set_caller(agent);
        assert_eq!(
            contract.try_agent_pay(target, U512::from(10u64), "wrong-purpose".to_string()),
            Err(Error::WrongPurpose.into())
        );
    }

    #[test]
    fn reverts_when_over_per_tx_limit() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        set_default_policy(&env, &mut contract, agent, target, 1_000, 5_000, u64::MAX);

        env.set_caller(agent);
        assert_eq!(
            contract.try_agent_pay(target, U512::from(1_001u64), PURPOSE.to_string()),
            Err(Error::AmountExceedsLimit.into())
        );
    }

    #[test]
    fn reverts_when_daily_cap_exceeded() {
        let (env, mut contract) = setup();
        let agent = env.get_account(1);
        let target = env.get_account(2);

        // max_per_tx = 1000, daily_cap = 1500: two payments of 800 each fit the
        // per-tx limit individually but blow the daily cap on the second call.
        set_default_policy(&env, &mut contract, agent, target, 1_000, 1_500, u64::MAX);

        env.set_caller(agent);
        contract.agent_pay(target, U512::from(800u64), PURPOSE.to_string());
        assert_eq!(contract.get_spent_today(agent), U512::from(800u64));

        assert_eq!(
            contract.try_agent_pay(target, U512::from(800u64), PURPOSE.to_string()),
            Err(Error::DailyCapExceeded.into())
        );
    }
}
