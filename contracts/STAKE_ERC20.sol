// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract STAKE_ERC20 is Ownable {
    IERC20 public rewardToken;
    IERC20 public stakingToken;
    uint256 public startTime;
    uint256 public totalStaked;
    uint256 public rewardPerSecond;
    uint256 public maxReward;
    bool public initialized;
    uint256 public totalReward;

    struct UserInfo {
        uint256 amount;
        uint256 lastRewardTime;
        uint256 totalReward;
        uint256 claimedReward;
    }

    mapping(address => UserInfo) public userInfo;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    modifier isInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    function initialize(
        IERC20 _rewardToken,
        IERC20 _stakingToken,
        uint256 _startTime,
        uint256 _rewardPerSecond,
        uint256 _maxReward
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        rewardToken = _rewardToken;
        stakingToken = _stakingToken;
        startTime = _startTime == 0 ? block.timestamp : _startTime;
        rewardPerSecond = _rewardPerSecond;
        maxReward = _maxReward;
        initialized = true;
    }

    function stake(uint256 amount) external isInitialized {
        require(block.timestamp >= startTime, "Staking not started yet");
        require(amount > 0, "Cannot stake 0");
        UserInfo storage user = userInfo[msg.sender];
        updateReward(msg.sender);
        stakingToken.transferFrom(msg.sender, address(this), amount);
        user.amount += amount;
        totalStaked += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external isInitialized {
        require(amount > 0, "Cannot unstake 0");
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= amount, "Insufficient balance");
        updateReward(msg.sender);
        user.amount -= amount;
        totalStaked -= amount;
        stakingToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function getReward() external isInitialized {
        updateReward(msg.sender);
        UserInfo storage user = userInfo[msg.sender];
        uint256 reward = getPendingReward(msg.sender);
        if (reward > 0) {
            user.claimedReward += reward;
            rewardToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function getTotalReward(address userAddress) public view returns (uint256) {
        UserInfo storage user = userInfo[userAddress];
        return user.totalReward + calculateReward(userAddress);
    }

    function getPendingReward(
        address userAddress
    ) public view returns (uint256) {
        UserInfo storage user = userInfo[userAddress];
        return getTotalReward(userAddress) - user.claimedReward;
    }

    function updateReward(address userAddress) internal {
        UserInfo storage user = userInfo[userAddress];
        uint256 reward = calculateReward(userAddress);
        user.totalReward += reward;
        totalReward += reward;
        user.lastRewardTime = block.timestamp;
    }

    function calculateReward(
        address userAddress
    ) public view returns (uint256) {
        UserInfo storage user = userInfo[userAddress];
        if (
            totalStaked == 0 ||
            block.timestamp <= startTime ||
            totalReward >= maxReward
        ) {
            return 0;
        }
        uint256 timeDiff = block.timestamp - user.lastRewardTime;
        uint256 currentTotalReward = timeDiff * rewardPerSecond;
        if (currentTotalReward > maxReward) {
            currentTotalReward = maxReward;
        }
        uint256 share = (user.amount * 1e18) / totalStaked;
        return (currentTotalReward * share) / 1e18;
    }
}
