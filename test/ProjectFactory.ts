import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ProjectFactory__factory, ProjectFactory } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('ProjectFactory', function () {
  let ProjectFactory: ProjectFactory__factory;
  let projectFactory: ProjectFactory;
  let owner: SignerWithAddress;

  const tokens = (count: string) => ethers.parseUnits(count, 18);

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    ProjectFactory = (await ethers.getContractFactory(
      'ProjectFactory'
    )) as ProjectFactory__factory;
    projectFactory = (await ProjectFactory.deploy()) as ProjectFactory;
    await projectFactory.waitForDeployment();
  });

  it('Create', async function () {
    const txResponse = await projectFactory.create(tokens('3'), 'Test', 'TST');
    const tx = await txResponse.wait();
    await expect(tx).to.emit(projectFactory, 'ProjectCreated');
  });
});
