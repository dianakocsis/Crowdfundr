import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Project__factory, Project } from '../typechain-types';
import seedRandom from 'seedrandom';

describe('Project', function () {
  let Project: Project__factory;
  let project: Project;
  let owner: SignerWithAddress,
    addr1: SignerWithAddress,
    addr2: SignerWithAddress;

  const tokens = (count: string) => ethers.parseUnits(count, 18);

  function getRandomInt(max: number, rng: seedRandom.PRNG) {
    return Math.floor(rng() * Math.floor(max));
  }

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    Project = (await ethers.getContractFactory('Project')) as Project__factory;
    project = (await Project.deploy(
      owner.address,
      tokens('3'),
      'Test Project',
      'TST'
    )) as Project;
    await project.waitForDeployment();
  });

  it('Deployment', async function () {
    expect(await project.owner()).to.equal(owner.address);
    expect(await project.goal()).to.equal(tokens('3'));
    expect(await project.name()).to.equal('Test Project');
    expect(await project.symbol()).to.equal('TST');
    const blockTimestamp = (await ethers.provider.getBlock('latest'))!
      .timestamp;
    let deadline = await project.deadline();
    let thirtyDays = 30 * 24 * 60 * 60;
    let expectedDeadline = blockTimestamp + thirtyDays;
    let deviation = 5 * 60;
    expect(deadline).to.be.closeTo(expectedDeadline, deviation);
  });

  describe('Contributing', function () {
    it('Able to Contribute', async function () {
      await expect(
        project.connect(addr1).contribute({ value: tokens('0.001') })
      )
        .to.be.revertedWithCustomError(project, 'InvalidContribution')
        .withArgs(tokens('0.001'));

      await project.connect(addr1).contribute({ value: tokens('0.01') });

      expect(await project.contributions(addr1.address)).to.equal(
        tokens('0.01')
      );
    });

    it('No one can contribute past the deadline', async function () {
      let thirtyDays = 30 * 24 * 60 * 60;
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!
        .timestamp;
      await time.increase(thirtyDays);
      await expect(
        project.connect(addr1).contribute({ value: tokens('1') })
      ).to.be.revertedWithCustomError(project, 'CannotContribute');
    });

    it('No one can contribute if project is canceled', async function () {
      await project.cancel();
      await expect(
        project.connect(addr1).contribute({ value: tokens('1') })
      ).to.be.revertedWithCustomError(project, 'CannotContribute');
    });

    it('Cannot contribute over the goal', async function () {
      await project.connect(addr1).contribute({ value: tokens('3') });
      await expect(
        project.connect(addr1).contribute({ value: tokens('.01') })
      ).to.be.revertedWithCustomError(project, 'CannotContribute');
    });

    it('Contributed event emitted', async function () {
      const txResponse = await project
        .connect(addr1)
        .contribute({ value: tokens('3') });
      const tx = await txResponse.wait();

      await expect(tx)
        .to.emit(project, 'Contributed')
        .withArgs(addr1.address, tokens('3'));
    });
  });

  describe('Withdrawing', function () {
    it('Only owner can withdraw', async function () {
      await expect(project.connect(addr1).withdraw(50))
        .to.be.revertedWithCustomError(project, 'OnlyOwner')
        .withArgs(owner);
    });

    it("Owner can't withdraw if past the due date and did not reach goal", async function () {
      const thirtyOneDays = 31 * 24 * 60 * 60;

      await ethers.provider.send('evm_increaseTime', [thirtyOneDays]);
      await ethers.provider.send('evm_mine');

      await expect(project.connect(owner).withdraw(10)).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });

    it('Proper amount is withdrawed', async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('10'),
      });
      await project.connect(owner).withdraw(25);
      expect(await ethers.provider.getBalance(project.target)).to.be.equal(
        ethers.parseEther('7.5')
      );
    });
  });

  describe('Refunding', function () {
    it("Can't receive refund if did not contribute", async function () {
      await project.connect(owner).cancel();
      await expect(project.connect(addr1).refund()).to.be.revertedWith(
        'did not contribute'
      );
    });

    it('Cannot receive refund if project is still funding', async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('5'),
      });

      await expect(project.connect(addr1).refund()).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });

    it('Can receive refund if deadline passed and goal not reached', async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('5'),
      });

      expect(await ethers.provider.getBalance(project.target)).to.be.equal(
        ethers.parseEther('5')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.parseEther('5'));

      const thirtyOneDays = 31 * 24 * 60 * 60;

      await ethers.provider.send('evm_increaseTime', [thirtyOneDays]);
      await ethers.provider.send('evm_mine');

      await project.connect(addr1).refund();

      expect(await ethers.provider.getBalance(project.target)).to.be.equal(
        ethers.parseEther('0')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.parseEther('0'));
    });

    it('Can receive refund if project cancelled', async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('5'),
      });

      expect(await ethers.provider.getBalance(project.target)).to.be.equal(
        ethers.parseEther('5')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.parseEther('5'));

      await project.connect(owner).cancel();

      await project.connect(addr1).refund();

      expect(await ethers.provider.getBalance(project.target)).to.be.equal(
        ethers.parseEther('0')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.parseEther('0'));
    });
  });

  describe('Cancelling', function () {
    it('Can only be cancelled by Owner', async function () {
      await expect(project.connect(addr1).cancel())
        .to.be.revertedWithCustomError(project, 'OnlyOwner')
        .withArgs(owner);
    });

    it("Can't be cancelled if fully funded", async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('10'),
      });
      await expect(project.connect(owner).cancel()).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });
  });

  describe('NFT', function () {
    it('Tiers', async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('1'),
      });

      await project.connect(addr2).contribute({
        value: ethers.parseEther('.25'),
      });

      await project.connect(owner).contribute({
        value: ethers.parseEther('.1'),
      });

      expect(await project.connect(owner).getTier(1)).to.be.equal(1);

      expect(await project.connect(owner).getTier(6)).to.be.equal(2);

      expect(await project.connect(owner).getTier(11)).to.be.equal(3);

      expect(await project.connect(owner).ownerOf(6)).to.be.equal(
        addr2.address
      );
    });

    it('Balance of tokens', async function () {
      await project.connect(addr1).contribute({
        value: ethers.parseEther('.1'),
      });
      await project.connect(addr1).contribute({
        value: ethers.parseEther('.3'),
      });
      await project.connect(addr1).contribute({
        value: ethers.parseEther('1'),
      });

      expect(await project.connect(owner).balanceOf(addr1.address)).to.be.equal(
        3
      );
    });
  });
});
