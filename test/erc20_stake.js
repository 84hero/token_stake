const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stake Erc20", function () {

  async function deploySomeContract() {

    const [owner, otherAccount] = await ethers.getSigners();

    const STAKE_ERC20 = await ethers.getContractFactory("STAKE_ERC20");
    const stakeErc20 = await STAKE_ERC20.deploy();

    const ERC20_TOKEN = await ethers.getContractFactory("ERC20_TOKEN");
    const erc20StakeToken = await ERC20_TOKEN.deploy("Stake Token", "ST", owner.address);
    const erc20RewardToken = await ERC20_TOKEN.deploy("Reward Token", "RT", stakeErc20.address);

    //授权Token给质押合约
    await erc20StakeToken.approve(stakeErc20.address, ethers.constants.MaxInt256);

    return { stakeErc20, erc20StakeToken, erc20RewardToken, owner, otherAccount };
  }

  // describe("测试部署", function () {
  //   it("创建合约", async function () {
  //     const { stakeNft, erc721Token, erc20Token } = await loadFixture(deployOneYearLockFixture);
  //   });
  // });


  describe("Stake", () => {
    it("stake init", async function () {
      const { stakeErc20, erc20StakeToken, erc20RewardToken, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20RewardToken.address;
      let _stakingToken = erc20StakeToken.address;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20RewardToken.totalSupply();

      //初始化质押合约参数
      await stakeErc20.initialize(_rewardToken, _stakingToken, _startTime, _rewardPerSecond, _maxReward);
      expect(await stakeErc20.startTime()).to.lte(await time.latest());
    });


    it("stake", async function () {
      const { stakeErc20, erc20StakeToken, erc20RewardToken, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20RewardToken.address;
      let _stakingToken = erc20StakeToken.address;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20RewardToken.totalSupply();

      //初始化质押合约参数
      await stakeErc20.initialize(_rewardToken, _stakingToken, _startTime, _rewardPerSecond, _maxReward);

      //授权Token给质押合约
      expect(await erc20StakeToken.allowance(owner.address, stakeErc20.address)).is.gte(_maxReward);


      //发起质押
      await expect(await stakeErc20.stake(2)).changeTokenBalances(erc20StakeToken, [owner.address, stakeErc20.address], [-2, 2]);

      //链上数据检测
      expect((await stakeErc20.userInfo(owner.address)).amount).is.equal(2);
      expect(await stakeErc20.totalStaked()).is.equal(2);

      //取消质押
      await expect(await stakeErc20.unstake(1)).changeTokenBalances(erc20StakeToken, [owner.address, stakeErc20.address], [1, -1]);

      //链上数据检测
      expect((await stakeErc20.userInfo(owner.address)).amount).is.equal(1);
      expect(await stakeErc20.totalStaked()).is.equal(1);
    });

    it("claim", async function () {
      const { stakeErc20, erc20StakeToken, erc20RewardToken, owner, otherAccount } = await loadFixture(deploySomeContract);
      let _rewardToken = erc20RewardToken.address;
      let _stakingToken = erc20StakeToken.address;
      let _startTime = 0;
      let _rewardPerSecond = 1000;
      let _maxReward = await erc20RewardToken.totalSupply();

      //初始化质押合约参数
      await stakeErc20.initialize(_rewardToken, _stakingToken, _startTime, _rewardPerSecond, _maxReward);


      //发起质押
      await expect(await stakeErc20.stake(1)).changeTokenBalances(erc20StakeToken, [owner.address, stakeErc20.address], [-1, 1]);

      //检测奖励
      await time.increase(1);
      expect(await stakeErc20.getPendingReward(owner.address)).is.equal(_rewardPerSecond);
      await time.increase(4);
      expect(await stakeErc20.getPendingReward(owner.address)).is.equal(_rewardPerSecond * 5);

      //提取奖励

      await expect(await stakeErc20.getReward()).changeTokenBalances(erc20RewardToken, [owner.address, stakeErc20.address], [_rewardPerSecond * 6, 0 - _rewardPerSecond * 6]);

      //otherAccount发起质押
      await erc20StakeToken.transfer(otherAccount.address, 10);
      await erc20StakeToken.connect(otherAccount).approve(stakeErc20.address, 10);
      await expect(await stakeErc20.connect(otherAccount).stake(1)).changeTokenBalances(erc20StakeToken, [otherAccount.address, stakeErc20.address], [-1, 1]);
      await expect(await stakeErc20.connect(otherAccount).getReward()).changeTokenBalances(erc20RewardToken, [otherAccount.address, stakeErc20.address], [_rewardPerSecond / 2, 0 - _rewardPerSecond / 2]);

      await expect(await stakeErc20.connect(otherAccount).unstake(1)).changeTokenBalances(erc20StakeToken, [otherAccount.address, stakeErc20.address], [1, -1]);
      await expect(await stakeErc20.connect(otherAccount).getReward()).changeTokenBalances(erc20RewardToken, [otherAccount.address, stakeErc20.address], [_rewardPerSecond / 2, 0 - _rewardPerSecond / 2]);

      await time.increase(5);
      await expect(await stakeErc20.connect(otherAccount).getReward()).changeTokenBalances(erc20RewardToken, [otherAccount.address, stakeErc20.address], [0, 0]);

      //链上数据检测
      expect(await stakeErc20.totalStaked()).is.equal(1);
      expect((await stakeErc20.userInfo(owner.address)).amount).is.equal(1);
      expect((await stakeErc20.userInfo(otherAccount.address)).amount).is.equal(0);

    });
  });

  
});
