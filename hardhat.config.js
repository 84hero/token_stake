require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  gasReporter: {
    enabled: 0,
    gasPrice: 5000000000
  }
};
