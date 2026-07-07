//! `odra-cli` entrypoint for deploying and interacting with `AgentVault`.
//!
//! Build the CLI binary with `cargo build --bin agent_vault_cli` and run it with
//! `--help` to see the deploy and scenario commands.

use odra::host::{HostEnv, NoArgs};
use odra_cli::{
    deploy::DeployScript, ContractProvider, DeployedContractsContainer, DeployerExt, OdraCli,
};
use agent_vault::agent_vault::AgentVault;

/// Deploys `AgentVault` and registers it in the deployed-contracts container.
pub struct AgentVaultDeployScript;

impl DeployScript for AgentVaultDeployScript {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        let _vault = AgentVault::load_or_deploy(
            env,
            NoArgs,
            container,
            350_000_000_000, // gas limit in motes; adjust for the target network
        )?;
        Ok(())
    }
}

/// Main function to run the CLI tool.
pub fn main() {
    OdraCli::new()
        .about("CLI tool for the AgentVault smart contract")
        .deploy(AgentVaultDeployScript)
        .contract::<AgentVault>()
        .build()
        .run();
}
