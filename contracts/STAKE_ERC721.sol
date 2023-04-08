// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract STAKE_ERC721 is Ownable, ReentrancyGuard, IERC721Receiver {
    IERC20 public rewardToken;
    IERC721 public stakingToken;
    uint256 public startTime;
    uint256 public totalStaked;
    uint256 public rewardPerSecond;
    uint256 public maxReward;
    bool public initialized;
    uint256 public totalReward;

    mapping(uint256 => address) public stakingNFTList;

    struct Stake {
        StakeNFT[] nftList;
        uint256 lastRewardTime;
        uint256 totalReward;
        uint256 claimedReward;
    }

    struct StakeNFT {
        uint256 tokenId;
        uint256 stakeTime;
    }

    mapping(address => Stake) public stakes;

    event Staked(address indexed user, uint256 tokenId);
    event Unstaked(address indexed user, uint256 tokenId);
    event RewardPaid(address indexed user, uint256 reward);

    modifier isInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function initialize(
        IERC20 _rewardToken,
        IERC721 _stakingToken,
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

    function stake(
        uint256[] calldata tokenIds
    ) external nonReentrant isInitialized {
        require(block.timestamp >= startTime, "Staking not started yet");
        uint256 length = tokenIds.length;
        require(length > 0, "Cannot stake 0");
        Stake storage _stake = stakes[msg.sender];
        updateReward(msg.sender);
        for (uint256 i = 0; i < length; ++i) {
            stakingToken.safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );
            stakingNFTList[tokenIds[i]] = msg.sender;
            _stake.nftList.push(StakeNFT(tokenIds[i], block.timestamp));
            emit Staked(msg.sender, tokenIds[i]);
        }
        totalStaked += length;
    }

    function _getStakeIndex(
        address _staker,
        uint256 _tokenId
    ) internal view returns (uint256) {
        for (uint256 i = 0; i < stakes[_staker].nftList.length; i++) {
            if (stakes[_staker].nftList[i].tokenId == _tokenId) {
                return i;
            }
        }
        return type(uint256).max;
    }

    function unstake(
        uint256[] calldata tokenIds
    ) external nonReentrant isInitialized {
        require(tokenIds.length > 0, "Cannot unstake 0");
        Stake storage _staker = stakes[msg.sender];
        require(_staker.nftList.length > 0, "staker amount 0");
        updateReward(msg.sender);
        totalStaked -= tokenIds.length;
        for (uint8 i = 0; i < tokenIds.length; ++i) {
            require(stakingNFTList[tokenIds[i]] == msg.sender);
            stakingToken.safeTransferFrom(
                address(this),
                msg.sender,
                tokenIds[i]
            );
            _staker.nftList[i] = _staker.nftList[_staker.nftList.length - 1];
            _staker.nftList.pop();
            delete stakingNFTList[tokenIds[i]];
            emit Unstaked(msg.sender, tokenIds[i]);
        }
    }

    function getReward() external nonReentrant isInitialized {
        updateReward(msg.sender);
        Stake storage _staker = stakes[msg.sender];
        uint256 reward = getPendingReward(msg.sender);
        if (reward > 0) {
            _staker.claimedReward += reward;
            rewardToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function getTotalReward(address userAddress) public view returns (uint256) {
        Stake storage _staker = stakes[userAddress];
        return _staker.totalReward + calculateReward(userAddress);
    }

    function getUserStake(
        address userAddress
    ) public view returns (Stake memory staker) {
        staker = stakes[userAddress];
    }

    function getPendingReward(
        address userAddress
    ) public view returns (uint256) {
        Stake storage _staker = stakes[userAddress];
        return getTotalReward(userAddress) - _staker.claimedReward;
    }

    function updateReward(address userAddress) internal {
        Stake storage _staker = stakes[userAddress];
        uint256 reward = calculateReward(userAddress);
        _staker.totalReward += reward;
        totalReward += reward;
        _staker.lastRewardTime = block.timestamp;
    }

    function calculateReward(
        address userAddress
    ) public view returns (uint256) {
        Stake storage _staker = stakes[userAddress];
        if (_staker.nftList.length == 0) return 0;
        if (
            totalStaked == 0 ||
            block.timestamp <= startTime ||
            totalReward >= maxReward
        ) {
            return 0;
        }
        uint256 timeDiff = block.timestamp - _staker.lastRewardTime;
        uint256 currentTotalReward = timeDiff * rewardPerSecond;
        if (currentTotalReward > maxReward) {
            currentTotalReward = maxReward;
        }

        uint256 share = (currentTotalReward * _staker.nftList.length) /
            totalStaked;
        return share;
    }
}
