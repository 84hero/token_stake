// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20_TOKEN is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        address to_
    ) ERC20(name_, symbol_) {
        _mint(to_, 100 * 10000 * 10 ** decimals());
    }
    
}
