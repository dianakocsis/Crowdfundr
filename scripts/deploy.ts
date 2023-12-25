import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  const projectFactory = await ethers.deployContract('ProjectFactory');

  await projectFactory.waitForDeployment();

  console.log('ProjectFactory address:', projectFactory.target);

  await projectFactory.create(10, 'Test', 'TST');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
