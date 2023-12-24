const { expect } = require('chai');
const abi = require('../artifacts/contracts/Project.sol/Project.json').abi;

describe('Crowdfunding Contract', function () {
  let Crowdfunding;
  let crowdfunding;
  let projectAddress;
  let project;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    Crowdfunding = await ethers.getContractFactory('Crowdfunding');
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    crowdfunding = await Crowdfunding.deploy();

    await crowdfunding.connect(owner).registerProject('Test', 10);
    [projectAddress] = await crowdfunding
      .connect(owner)
      .getRegisteredProjects(); // get access to project address that was created
    project = new ethers.Contract(projectAddress, abi, owner); // accessing contract that exists at this address
  });

  describe('Deployment', function () {
    it('Marks correct creator', async function () {
      expect(await project.creator()).to.equal(owner.address);
    });

    it('Marks correct title', async function () {
      expect(await project.title()).to.equal('Test');
    });
  });

  describe('Contributing', function () {
    it('Requires a minimum amount of ether to contribute', async function () {
      await expect(
        project.connect(addr1).contribute({
          value: ethers.utils.parseEther('.009'),
        })
      ).to.be.revertedWith('Need to make a larger contribution');
    });

    it('Cannot contribute if goal has been reached', async function () {
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('10'),
      });
      await expect(
        project.connect(addr2).contribute({
          value: ethers.utils.parseEther('1.0'),
        })
      ).to.be.revertedWith('Cannot be called at this time.');
    });

    it('Cannot contribute after 30 days', async function () {
      const thirtyOneDays = 31 * 24 * 60 * 60;

      await ethers.provider.send('evm_increaseTime', [thirtyOneDays]);
      await ethers.provider.send('evm_mine');

      await expect(project.connect(addr1).contribute()).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });

    it('Cannot contribute if project has been cancelled', async function () {
      await project.connect(owner).cancel();

      await expect(
        project.connect(addr2).contribute({
          value: ethers.utils.parseEther('1.0'),
        })
      ).to.be.revertedWith('Cannot be called at this time.');
    });
  });

  describe('Withdrawing', function () {
    it('Only creator can withdraw', async function () {
      await expect(project.connect(addr1).withdraw(50)).to.be.revertedWith(
        'Not creator'
      );
    });

    it("Creator can't withdraw if past the due date and did not reach goal", async function () {
      const thirtyOneDays = 31 * 24 * 60 * 60;

      await ethers.provider.send('evm_increaseTime', [thirtyOneDays]);
      await ethers.provider.send('evm_mine');

      await expect(project.connect(owner).withdraw(10)).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });

    it('Proper amount is withdrawed', async function () {
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('10'),
      });
      await project.connect(owner).withdraw(25);
      expect(await ethers.provider.getBalance(projectAddress)).to.be.equal(
        ethers.utils.parseEther('7.5')
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
        value: ethers.utils.parseEther('5'),
      });

      await expect(project.connect(addr1).refund()).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });

    it('Can receive refund if deadline passed and goal not reached', async function () {
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('5'),
      });

      expect(await ethers.provider.getBalance(projectAddress)).to.be.equal(
        ethers.utils.parseEther('5')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.utils.parseEther('5'));

      const thirtyOneDays = 31 * 24 * 60 * 60;

      await ethers.provider.send('evm_increaseTime', [thirtyOneDays]);
      await ethers.provider.send('evm_mine');

      await project.connect(addr1).refund();

      expect(await ethers.provider.getBalance(projectAddress)).to.be.equal(
        ethers.utils.parseEther('0')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.utils.parseEther('0'));
    });

    it('Can receive refund if project cancelled', async function () {
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('5'),
      });

      expect(await ethers.provider.getBalance(projectAddress)).to.be.equal(
        ethers.utils.parseEther('5')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.utils.parseEther('5'));

      await project.connect(owner).cancel();

      await project.connect(addr1).refund();

      expect(await ethers.provider.getBalance(projectAddress)).to.be.equal(
        ethers.utils.parseEther('0')
      );
      expect(
        await project.connect(owner).getContribution(addr1.address)
      ).to.be.equal(ethers.utils.parseEther('0'));
    });
  });

  describe('Cancelling', function () {
    it('Can only be cancelled by creator', async function () {
      await expect(project.connect(addr1).cancel()).to.be.revertedWith(
        'Not creator'
      );
    });

    it("Can't be cancelled if fully funded", async function () {
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('10'),
      });
      await expect(project.connect(owner).cancel()).to.be.revertedWith(
        'Cannot be called at this time.'
      );
    });
  });

  describe('NFT', function () {
    it('Tiers', async function () {
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('1'),
      });

      await project.connect(addr2).contribute({
        value: ethers.utils.parseEther('.25'),
      });

      await project.connect(owner).contribute({
        value: ethers.utils.parseEther('.1'),
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
        value: ethers.utils.parseEther('.1'),
      });
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('.3'),
      });
      await project.connect(addr1).contribute({
        value: ethers.utils.parseEther('1'),
      });

      expect(await project.connect(owner).balanceOf(addr1.address)).to.be.equal(
        3
      );
    });
  });
});
