// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract STAKE_ERC1155 is Ownable, ReentrancyGuard, IERC1155Receiver, ERC165 {
    IERC20 public rewardToken;
    IERC1155 public stakingToken;
    uint256 public stakingTokenId;
    uint256 public startTime;
    uint256 public totalStaked;
    uint256 public rewardPerSecond;
    uint256 public maxReward;
    bool public initialized;
    uint256 public totalReward;

    struct Stake {
        uint256 amount;
        uint256 lastRewardTime;
        uint256 totalReward;
        uint256 claimedReward;
    }

    mapping(address => Stake) public stakes;

    event Staked(address indexed _stake, uint256 tokenId);
    event Unstaked(address indexed _stake, uint256 tokenId);
    event RewardPaid(address indexed _stake, uint256 reward);

    modifier isInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    constructor() {}

    function initialize(
        IERC20 _rewardToken,
        IERC1155 _stakingToken,
        uint256 _stakingTokenId,
        uint256 _startTime,
        uint256 _rewardPerSecond,
        uint256 _maxReward
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        rewardToken = _rewardToken;
        stakingToken = _stakingToken;
        stakingTokenId = _stakingTokenId;
        startTime = _startTime == 0 ? block.timestamp : _startTime;
        rewardPerSecond = _rewardPerSecond;
        maxReward = _maxReward;
        initialized = true;
    }

    function stake(uint256 amount) external nonReentrant isInitialized {
        require(block.timestamp >= startTime, "Staking not started yet");
        require(amount > 0, "Cannot stake 0");
        Stake storage _stake = stakes[msg.sender];
        updateReward(msg.sender);
        stakingToken.safeTransferFrom(
            msg.sender,
            address(this),
            stakingTokenId,
            amount,
            "0x"
        );
        _stake.amount += amount;
        totalStaked += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant isInitialized {
        require(amount > 0, "Cannot unstake 0");
        Stake storage _stake = stakes[msg.sender];
        require(_stake.amount > 0, "_stake amount 0");
        updateReward(msg.sender);
        _stake.amount -= amount;
        totalStaked -= amount;
        stakingToken.safeTransferFrom(
            address(this),
            msg.sender,
            stakingTokenId,
            amount,
            "0x"
        );
        emit Unstaked(msg.sender, amount);
    }

    function getReward() external nonReentrant isInitialized {
        updateReward(msg.sender);
        Stake storage _stake = stakes[msg.sender];
        uint256 reward = getPendingReward(msg.sender);
        if (reward > 0) {
            _stake.claimedReward += reward;
            rewardToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function getTotalReward(address userAddress) public view returns (uint256) {
        Stake storage _stake = stakes[userAddress];
        return _stake.totalReward + calculateReward(userAddress);
    }

    function getPendingReward(
        address userAddress
    ) public view returns (uint256) {
        Stake storage _stake = stakes[userAddress];
        return getTotalReward(userAddress) - _stake.claimedReward;
    }

    function updateReward(address userAddress) internal {
        Stake storage _stake = stakes[userAddress];
        uint256 reward = calculateReward(userAddress);
        _stake.totalReward += reward;
        totalReward += reward;
        _stake.lastRewardTime = block.timestamp;
    }

    function calculateReward(
        address userAddress
    ) public view returns (uint256) {
        Stake storage _stake = stakes[userAddress];
        if (
            totalStaked == 0 ||
            block.timestamp <= startTime ||
            totalReward >= maxReward
        ) {
            return 0;
        }
        uint256 timeDiff = block.timestamp - _stake.lastRewardTime;
        uint256 currentTotalReward = timeDiff * rewardPerSecond;
        if (currentTotalReward > maxReward) {
            currentTotalReward = maxReward;
        }
        uint256 share = (currentTotalReward * _stake.amount) / totalStaked;
        return share;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, ERC165) returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
