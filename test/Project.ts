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

  describe('Claiming', function () {
    it('Able to claim', async function () {
      await project.connect(addr1).contribute({ value: tokens('0.01') });
      await expect(
        project.connect(addr1).claim(addr2.address)
      ).to.be.revertedWithCustomError(project, 'CannotClaim');
      expect(await project.balanceOf(addr2.address)).to.equal(0);
      expect(await project.balanceOf(addr1.address)).to.equal(0);
      await project.connect(addr1).contribute({ value: tokens('0.99') });
      await project.connect(addr1).claim(addr2.address);
      expect(await project.balanceOf(addr2.address)).to.equal(1);
      expect(await project.balanceOf(addr1.address)).to.equal(0);
      expect(await project.contributions(addr1.address)).to.equal(tokens('1'));
      expect(await project.contributions(addr2.address)).to.equal(tokens('0'));
    });

    it('Can claim multiple times', async function () {
      await project.connect(addr1).contribute({ value: tokens('1') });
      await project.connect(addr1).claim(addr1.address);
      expect(await project.balanceOf(addr1.address)).to.equal(1);
      await project.connect(addr1).contribute({ value: tokens('0.5') });
      await expect(
        project.connect(addr1).claim(addr1.address)
      ).to.be.revertedWithCustomError(project, 'CannotClaim');
      expect(await project.balanceOf(addr1.address)).to.equal(1);
      await project.connect(addr1).contribute({ value: tokens('0.5') });
      await project.connect(addr1).claim(addr1.address);
      expect(await project.balanceOf(addr1.address)).to.equal(2);
    });

    it('Claimed event emitted', async function () {
      await project.connect(addr1).contribute({ value: tokens('3') });
      const txResponse = await project.connect(addr1).claim(addr2.address);
      const tx = await txResponse.wait();
      await expect(tx).to.emit(project, 'Claimed').withArgs(addr2.address, 3);
    });

    it('Fuzzing', async function () {
      const seed = Math.random().toString();
      const rng = seedRandom(seed);

      const signers = await ethers.getSigners();
      for (let i = 0; i < 100_000; i++) {
        if (
          (await ethers.provider.getBalance(project)) >= (await project.goal())
        ) {
          break;
        }
        const randomInt = getRandomInt(signers.length, rng);
        const randomSigner = signers[randomInt];
        let randomEthAmount = BigInt(getRandomInt(10, rng)) * tokens('0.5');

        if (randomEthAmount <= tokens('0.1')) {
          randomEthAmount = randomEthAmount + tokens('0.1');
        }

        await project
          .connect(randomSigner)
          .contribute({ value: randomEthAmount });
      }

      for (const signer of signers) {
        const contributeAmount = await project.contributions(signer.address);
        if (contributeAmount / tokens('1') < 1) {
          continue;
        }
        await project.connect(signer).claim(signer.address);
        const expectedNumNFTs = contributeAmount / tokens('1');
        expect(await project.balanceOf(signer.address)).to.equal(
          expectedNumNFTs
        );
      }
    });
  });

  describe('Withdrawing', function () {
    it('Able to withdraw', async function () {
      expect(await ethers.provider.getBalance(project)).to.equal(0);
      await project.connect(addr1).contribute({ value: await project.goal() });
      let initialBalance = await ethers.provider.getBalance(addr1.address);
      expect(await ethers.provider.getBalance(project)).to.equal(
        await project.goal()
      );
      await project.withdraw(addr1.address, await project.goal());
      expect(await ethers.provider.getBalance(addr1.address)).to.equal(
        initialBalance + (await project.goal())
      );
      expect(await ethers.provider.getBalance(project)).to.equal(0);
    });

    it('Only owner can withdraw', async function () {
      await project.connect(addr1).contribute({ value: tokens('0.1') });
      await expect(
        project.connect(addr1).withdraw(addr1.address, await project.goal())
      )
        .to.be.revertedWithCustomError(project, 'OnlyOwner')
        .withArgs(owner.address);
    });

    it('Owner cannot withdraw if goal not met', async function () {
      await project.connect(addr1).contribute({ value: tokens('0.1') });
      await expect(
        project.withdraw(owner.address, await project.goal())
      ).to.be.revertedWithCustomError(project, 'CannotWithdraw');
    });

    it('Can withdraw in increments', async function () {
      expect(await ethers.provider.getBalance(project)).to.equal(0);
      await project.connect(addr1).contribute({ value: await project.goal() });
      let initialBalance = await ethers.provider.getBalance(addr1.address);
      expect(await ethers.provider.getBalance(project)).to.equal(
        await project.goal()
      );
      await project.withdraw(addr1.address, tokens('1'));
      expect(await ethers.provider.getBalance(addr1.address)).to.equal(
        initialBalance + tokens('1')
      );
      expect(await ethers.provider.getBalance(project)).to.equal(tokens('2'));
      await project.withdraw(addr1.address, tokens('2'));
      expect(await ethers.provider.getBalance(addr1.address)).to.equal(
        initialBalance + (await project.goal())
      );
      expect(await ethers.provider.getBalance(project)).to.equal('0');
    });

    it('Withdrawn event emitted', async function () {
      await project.connect(addr1).contribute({ value: await project.goal() });
      const txResponse = await project.withdraw(
        addr1.address,
        await project.goal()
      );
      const tx = await txResponse.wait();
      await expect(tx)
        .to.emit(project, 'Withdrawn')
        .withArgs(addr1.address, await project.goal());
    });
  });

  describe('Cancelling', function () {
    it('Able to cancel', async function () {
      await project.cancel();
      expect(await project.canceled()).to.equal(true);
    });

    it('Cannot cancel - project funded', async function () {
      await project.connect(addr1).contribute({ value: tokens('3') });
      await expect(project.cancel()).to.be.revertedWithCustomError(
        project,
        'CannotCancel'
      );
    });

    it('Cannot cancel - days have passed', async function () {
      let thirtyDays = 30 * 24 * 60 * 60;
      await time.increase(thirtyDays);
      await expect(project.cancel()).to.be.revertedWithCustomError(
        project,
        'CannotCancel'
      );
    });

    it('Cannot cancel - days have passed and project funded', async function () {
      await project.connect(addr1).contribute({ value: tokens('3') });
      let thirtyDays = 30 * 24 * 60 * 60;
      await time.increase(thirtyDays);
      await expect(project.cancel()).to.be.revertedWithCustomError(
        project,
        'CannotCancel'
      );
    });

    it('Canceled event emitted', async function () {
      const txResponse = await project.cancel();
      const tx = await txResponse.wait();
      await expect(tx).to.emit(project, 'Canceled');
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
