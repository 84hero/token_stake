
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Stake ERC1155", function () {

  async function deploySomeContract() {

    const [owner, otherAccount] = await ethers.getSigners();

    const STAKE_NFT = await ethers.getContractFactory("STAKE_ERC1155");
    const stakeNft = await STAKE_NFT.deploy();

    const ERC1155_TOKEN = await ethers.getContractFactory("ERC1155_TOKEN");
    const nftToken = await ERC1155_TOKEN.deploy();

    await nftToken.mint(owner.address, 0, 100, "0x");

    const ERC20_TOKEN = await ethers.getContractFactory("ERC20_TOKEN");
    const erc20Token = await ERC20_TOKEN.deploy("Reward Token", "RT", stakeNft.address);

    return { stakeNft, nftToken, erc20Token, owner, otherAccount };
  }

  describe("Stake", () => {
    it("stake init", async function () {
      const { stakeNft, nftToken, erc20Token, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20Token.address;
      let _stakingToken = nftToken.address;
      let _stakingTokenId = 0;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20Token.totalSupply();

      //初始化质押合约参数
      await stakeNft.initialize(_rewardToken, _stakingToken, _stakingTokenId, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeNft.startTime()).to.lte(await time.latest());
    });

    it("stake", async function () {
      const { stakeNft, nftToken, erc20Token, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20Token.address;
      let _stakingToken = nftToken.address;
      let _stakingTokenId = 0;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20Token.totalSupply();

      //初始化质押合约参数
      await stakeNft.initialize(_rewardToken, _stakingToken, _stakingTokenId, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeNft.maxReward()).to.equal(_maxReward);

      //授权NFT给质押合约
      await nftToken.setApprovalForAll(stakeNft.address, true);
      expect(await nftToken.isApprovedForAll(owner.address, stakeNft.address)).is.equal(true);

      //发起质押
      await stakeNft.stake(2);
      expect(await nftToken.balanceOf(owner.address, 0)).is.equal(98);
      expect(await nftToken.balanceOf(stakeNft.address, 0)).is.equal(2);

      //取消质押
      await stakeNft.unstake(1);
      expect(await nftToken.balanceOf(owner.address, 0)).is.equal(99);
      expect(await nftToken.balanceOf(stakeNft.address, 0)).is.equal(1);
      expect((await stakeNft.stakes(owner.address)).amount).is.equal(1);


      //链上数据检测
      await stakeNft.unstake(1);
      expect(await stakeNft.totalStaked()).is.equal(0);
      expect((await stakeNft.stakes(owner.address)).amount).is.equal(0);

    });

    it("claim", async function () {
      const { stakeNft, nftToken, erc20Token, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20Token.address;
      let _stakingToken = nftToken.address;
      let _stakingTokenId = 0;

      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20Token.totalSupply();

      //初始化质押合约参数
      await stakeNft.initialize(_rewardToken, _stakingToken, _stakingTokenId, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeNft.maxReward()).to.equal(_maxReward);

      //授权NFT给质押合约
      await nftToken.setApprovalForAll(stakeNft.address, true);
      expect(await nftToken.isApprovedForAll(owner.address, stakeNft.address)).is.equal(true);

      //发起质押
      await stakeNft.stake(1);
      stake = await stakeNft.stakes(owner.address);
      expect(await time.latest()).is.equal(stake.lastRewardTime);

      //检测奖励
      await time.increase(1);
      expect(await stakeNft.getPendingReward(owner.address)).is.equal(_rewardPerSecond);
      await time.increase(4);
      expect(await stakeNft.getPendingReward(owner.address)).is.equal(_rewardPerSecond * 5);

      //提取奖励
      pendingReward = await stakeNft.getPendingReward(owner.address);
      await stakeNft.getReward();
      stake = await stakeNft.stakes(owner.address)
      expect(stake.totalReward).is.eq(stake.claimedReward);

      await nftToken.safeTransferFrom(owner.address, otherAccount.address, _stakingTokenId, 10, "0x");
      await nftToken.connect(otherAccount).setApprovalForAll(stakeNft.address, true);
      await stakeNft.connect(otherAccount).stake(1);
      await stakeNft.connect(otherAccount).stake(1);
      stake = await stakeNft.stakes(otherAccount.address)
      expect(stake.totalReward).is.eq(_rewardPerSecond / 2);

      //链上数据检测
      expect(await stakeNft.totalStaked()).is.equal(3);
      expect((await stakeNft.stakes(owner.address)).amount).is.equal(1);
      expect((await stakeNft.stakes(otherAccount.address)).amount).is.equal(2);
    });
  });


});
