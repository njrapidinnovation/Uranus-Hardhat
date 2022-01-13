require("@nomiclabs/hardhat-waffle");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const BNB_PRIVATE_KEY = '42d029c8fe7834fff5cf7f99a8434642d6eed45ac26cb748ada74f102e6a73a5';

module.exports = {
  mocha: {
    timeout: 60000
  },
  defaultNetwork: "localhost",
  networks: {
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [`0x${BNB_PRIVATE_KEY}`]
    },
    mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [`0x${BNB_PRIVATE_KEY}`]
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      // mining: {
      //   auto: true,
      //   interval: 3000
      // },
      timeout: 600000
    },
    hardhat: {
      forking: {
        url: "https://speedy-nodes-nyc.moralis.io/f19381e84e5c8dde5935ae3e/bsc/mainnet/archive",
      },
    },
  },
  solidity: {
    compilers: [
      {
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
        version: "0.8.0"
      },
      {
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
        version: "0.5.16"
      },
    ],
  },
};


