
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Stake ERC721", function () {

  async function deploySomeContract() {

    const [owner, otherAccount] = await ethers.getSigners();

    const STAKE_ERC721 = await ethers.getContractFactory("STAKE_ERC721");
    const stakeNft = await STAKE_ERC721.deploy();

    const ERC721_TOKEN = await ethers.getContractFactory("ERC721_TOKEN");
    const nftToken = await ERC721_TOKEN.deploy();

    const ERC20_TOKEN = await ethers.getContractFactory("ERC20_TOKEN");
    const erc20Token = await ERC20_TOKEN.deploy("Reward Token", "RT", stakeNft.address);

    return { stakeNft, nftToken, erc20Token, owner, otherAccount };
  }


  describe("Stake", () => {
    it("stake init", async function () {
      const { stakeNft, nftToken, erc20Token, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20Token.address;
      let _stakingToken = nftToken.address;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20Token.totalSupply();

      //初始化质押合约参数
      await stakeNft.initialize(_rewardToken, _stakingToken, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeNft.startTime()).to.lte(await time.latest());
    });

    it("stake", async function () {
      const { stakeNft, nftToken, erc20Token, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20Token.address;
      let _stakingToken = nftToken.address;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20Token.totalSupply();

      //初始化质押合约参数
      await stakeNft.initialize(_rewardToken, _stakingToken, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeNft.maxReward()).to.equal(_maxReward);

      //授权NFT给质押合约
      await nftToken.setApprovalForAll(stakeNft.address, true);
      expect(await nftToken.isApprovedForAll(owner.address, stakeNft.address)).is.equal(true);

      //发起质押
      expect(await nftToken.ownerOf(0)).is.equal(owner.address);
      await stakeNft.stake([0, 1]);
      expect(await nftToken.ownerOf(0)).is.equal(stakeNft.address);
  
      //取消质押
      await time.increase(1);
      await stakeNft.unstake([0]);
      expect(await nftToken.ownerOf(0)).is.equal(owner.address);
      expect(await nftToken.ownerOf(1)).is.equal(stakeNft.address);
      expect((await stakeNft.getUserStake(owner.address))["nftList"].length).is.equal(1);

      await stakeNft.unstake([1]);
      expect(await nftToken.ownerOf(1)).is.equal(owner.address);

      //链上数据检测
      expect(await stakeNft.totalStaked()).is.equal(0);
      expect((await stakeNft.getUserStake(owner.address))["nftList"].length).is.equal(0);

    });

    it("claim", async function () {
      const { stakeNft, nftToken, erc20Token, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20Token.address;
      let _stakingToken = nftToken.address;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20Token.totalSupply();

      //初始化质押合约参数
      await stakeNft.initialize(_rewardToken, _stakingToken, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeNft.maxReward()).to.equal(_maxReward);

      //授权NFT给质押合约
      await nftToken.setApprovalForAll(stakeNft.address, true);
      expect(await nftToken.isApprovedForAll(owner.address, stakeNft.address)).is.equal(true);

      //发起质押
      await stakeNft.stake([0]);

      //检测奖励
      await time.increase(1);
      expect(await stakeNft.getPendingReward(owner.address)).is.equal(_rewardPerSecond);
      await time.increase(4);
      expect(await stakeNft.getPendingReward(owner.address)).is.equal(_rewardPerSecond * 5);

      //提取奖励
      pendingReward = await stakeNft.getPendingReward(owner.address);
      await stakeNft.getReward();
      stake = await stakeNft.getUserStake(owner.address)
      expect(stake.totalReward).is.eq(stake.claimedReward);

      await nftToken.transferFrom(owner.address, otherAccount.address, 5);
      await nftToken.transferFrom(owner.address, otherAccount.address, 6);
      expect(await nftToken.ownerOf(5)).is.equal(otherAccount.address);
      await nftToken.connect(otherAccount).setApprovalForAll(stakeNft.address, true);
      await stakeNft.connect(otherAccount).stake([5]);
      await stakeNft.connect(otherAccount).stake([6]);
      stake = await stakeNft.getUserStake(otherAccount.address)
      expect(stake.totalReward).is.eq(_rewardPerSecond / 2);

      //链上数据检测
      expect(await stakeNft.totalStaked()).is.equal(3);
      expect((await stakeNft.getUserStake(owner.address))["nftList"].length).is.equal(1);
      expect((await stakeNft.getUserStake(otherAccount.address))["nftList"].length).is.equal(2);
    });
  });


});
