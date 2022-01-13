const { expect } = require("chai");
const { ethers } = require("hardhat");
const infinity_abi = require("../artifacts/contracts/infinityVault.sol/InfinityVault.json"); 

const zeroAddress = "0x0000000000000000000000000000000000000000";

//Infinity Vault Deployment Params:
const _name = "Infinity Gamma";
const _symbol = "iGAMMA";
const _gToken = "0x0c6dd143F4b86567d6c21E8ccfD0300f00896442" //gGAMMA address
const _gammaTroller = "0xF54f9e7070A1584532572A6F640F09c606bb9A83"; //GammaTroller address
const _gamma = "0xb3Cb6d2f8f2FDe203a022201C81a96c167607F15"; //GAMMA address

//Account To Impersonate
const accountToImpersonate = "0xD1Ec391627c9E2Fb0c570Da876Bc75dF23c42BEB" //Raj's Account

let user1;
let user2;
let user3;
let _withdrawFeeAddress;
let _performanceFeeAddress;
let infinityVault;
let gToken;


describe("RESET MAINNET FORK",function () {
  it("Should reset mainnet fork",async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://speedy-nodes-nyc.moralis.io/f19381e84e5c8dde5935ae3e/bsc/mainnet/archive",
          },
        },
      ],
    });
  });
});


describe("INFINITY VAULT CONTRACT DEPLOYMENT", function () {
  
  it("Should Deploy", async function () {
    [user1,user2,user3,user4] = await ethers.getSigners();
    _withdrawFeeAddress = user3.address;
    _performanceFeeAddress = user4.address;
    const InfinityVault = await ethers.getContractFactory("contracts/infinityVault.sol:InfinityVault");
    infinityVault = await InfinityVault.deploy(_name,_symbol,_gToken,_gammaTroller,_withdrawFeeAddress,_performanceFeeAddress,_gamma);
  });

  it("Should Check Name", async function () {
    const name = await infinityVault.name();
    expect(_name).to.equal(name);
  });

  it("Should Check Symbol", async function () {
    const symbol = await infinityVault.symbol();
    expect(_symbol).to.equal(symbol);
  });

  it("Should Check gToken Address", async function () {
    const gToken_address = await infinityVault.gToken();
    expect(_gToken).to.equal(gToken_address);
  });

  it("Should Check gammaTroller Address", async function () {
    const gammaTroller = await infinityVault.gammaTroller();
    expect(_gammaTroller).to.equal(gammaTroller);
  });

  it("Should Check gamma token allowance to gToken contract is uint96 MAX or Not", async function () {
    const GAMMA = await ethers.getContractAt(infinity_abi.abi,_gamma);
    const allowance = await GAMMA.allowance(infinityVault.address,_gToken);
    const allowance_val = BigInt(Math.pow(2,96)) - BigInt(1);
    expect(allowance).to.equal(allowance_val);
  });
  it("Should Check withdrawFeeAddress", async function () {
    const withdrawFeeAddress = await infinityVault.withdrawFeeAddress();
    expect(withdrawFeeAddress).to.equal(_withdrawFeeAddress);
  });
  it("Should Check performanceFeeAddress", async function () {
    const performanceFeeAddress = await infinityVault.performanceFeeAddress();
    expect(performanceFeeAddress).to.equal(_performanceFeeAddress);
  });

  it("Should Check minTime ToWithdraw gTOKEN", async function () {
    const minTimeToWithdraw = await infinityVault.minTimeToWithdraw();
    const minTime = 21 * 24 * 60 * 60; //21days 
    expect(minTimeToWithdraw).to.equal(minTime);
  });

});

describe("IMPERSONATE ACCOUNT",function () {

  let impersonated_gTOKEN_bal;

  it("Should Impersonate account and check gTOKEN balance of users with impersonated account", async function () {

    gToken = await ethers.getContractAt("contracts/gToken.sol:GErc20Delegator",_gToken);
    const gamma_token = await ethers.getContractAt("contracts/gToken.sol:GErc20Delegator",_gamma);
    
    //impersonating raj account
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [accountToImpersonate],
    });

    //Check impersonated account gTOKEN balance
    const signer = await ethers.getSigner(accountToImpersonate)
    impersonated_gTOKEN_bal = await gToken.balanceOf(accountToImpersonate);

    const impersonated_gamma_bal = await gamma_token.balanceOf(accountToImpersonate);

    //Transfer impersonated account half gTOKEN balance to user1 and half to user2 if impersonated_gTOKEN_bal > 0
    if( impersonated_gTOKEN_bal > 0){
      
      const amount_send_to_user1 = BigInt(impersonated_gTOKEN_bal) / BigInt(2);
      const amount_send_to_user2 = BigInt(impersonated_gTOKEN_bal) - amount_send_to_user1;

      await gToken.connect(signer).transfer(user1.address, amount_send_to_user1);
      await gToken.connect(signer).transfer(user2.address, amount_send_to_user2);
      await gamma_token.connect(signer).transfer(user1.address, impersonated_gamma_bal);
      
      const user1_gTOKEN_bal = await gToken.balanceOf(user1.address)
      const user2_gTOKEN_bal = await gToken.balanceOf(user2.address)
      const user1_gamma_bal = await gamma_token.balanceOf(user1.address)

      expect(user1_gTOKEN_bal).to.equal(amount_send_to_user1);
      expect(user2_gTOKEN_bal).to.equal(amount_send_to_user2);
      expect(user1_gamma_bal).to.equal(impersonated_gamma_bal);

    }

    //close impersonating
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [accountToImpersonate],
    });
    
  });

});

//Amount to be deposited by both user1 and user2
const amount = BigInt(101e8);

describe("TEST DEPOSIT", function () {

  it(`User1 Approves and deposit ${amount} gTOKEN into infinity vault`,async function () {
    
    //User1
    let allowance = await gToken.allowance(user1.address,infinityVault.address);
    if(amount > allowance){
      await gToken.connect(user1).approve(infinityVault.address,amount);
      allowance = await gToken.allowance(user1.address,infinityVault.address);
    }
    expect(allowance).to.equal(amount);

    const exchangeRate = await infinityVault.iTokenExchangeRate();
    const iGAMMA_minted = BigInt(amount) * BigInt(1e18) / BigInt(exchangeRate);

    await infinityVault.deposit(amount);

    const iGAMMA_user1_balance = await infinityVault.balanceOf(user1.address);
    expect(iGAMMA_user1_balance).to.equal(iGAMMA_minted);
    
  });

  it(`User2 Approves and deposit ${amount} gTOKEN after 24 hr into infinity vault`,async function () {

    const time = 1 * 24 * 60 * 60
    await network.provider.send("evm_increaseTime", [time])
    await network.provider.send("evm_mine")

    //User2
    let allowance = await gToken.allowance(user2.address,infinityVault.address);
    if(amount > allowance){
      await gToken.connect(user2).approve(infinityVault.address,amount);
      allowance = await gToken.allowance(user2.address,infinityVault.address);
    }
    expect(allowance).to.equal(amount);

    const exchangeRate = await infinityVault.iTokenExchangeRate();
    const iGAMMA_minted = BigInt(amount) * BigInt(1e18) / BigInt(exchangeRate);

    await infinityVault.connect(user2).deposit(amount);

    const iGAMMA_user2_balance = await infinityVault.balanceOf(user2.address);
    expect(iGAMMA_user2_balance).to.equal(iGAMMA_minted);
    
  });

  it("should revert with Reason if 0 amount is deposited",async function () {
    await expect(infinityVault.deposit(0)).to.be.revertedWith("Nothing to deposit");
  })

});


describe("TEST EARN",function () {

  it("check performance Fee",async function() {

    // const gammaTroller_inst = await ethers.getContractAt("contracts/Gammatroller.sol:Gammatroller",_gammaTroller);
    // await gammaTroller_inst["claimGamma(address[],address[],bool,bool)"]([infinityVault.address],[_gToken],false,true);


    const performance_fee_address = await infinityVault.performanceFeeAddress();

    const PERFORMNACE_FEE_ADDRESS_OLD_GGAMMA_BAL = await gToken.balanceOf(performance_fee_address);
    
    const performanceFee = await infinityVault.performanceFee();

    const INFINITY_VAULT_OLD_GGAMMA_BALANCE = await gToken.balanceOf(infinityVault.address);

    await infinityVault._earn();

    const PERFORMNACE_FEE_ADDRESS_NEW_GGAMMA_BAL = await gToken.balanceOf(performance_fee_address);

    const INFINITY_VAULT_NEW_GGAMMA_BALANCE = BigInt(INFINITY_VAULT_OLD_GGAMMA_BALANCE) + (BigInt(10000) / BigInt(performanceFee)) * 
    BigInt(PERFORMNACE_FEE_ADDRESS_NEW_GGAMMA_BAL - PERFORMNACE_FEE_ADDRESS_OLD_GGAMMA_BAL);

    let fee = INFINITY_VAULT_NEW_GGAMMA_BALANCE - BigInt(INFINITY_VAULT_OLD_GGAMMA_BALANCE);
    fee = BigInt(fee) * BigInt(performanceFee) / BigInt(10000);

    expect(BigInt(PERFORMNACE_FEE_ADDRESS_NEW_GGAMMA_BAL - PERFORMNACE_FEE_ADDRESS_OLD_GGAMMA_BAL)).to.equal(fee);

  })

});

describe("TEST UNSTAKING",function() {

  it("test with unstakeAmount as 0",async function() {
    await expect(infinityVault.startUnstake(0)).to.be.revertedWith("!!Unstake Amount should be greater than zero");
  })

  it("test with unstakeAmount greater than iGAMMA balance",async function() {
    const user_iGAMMA_bal = await infinityVault.balanceOf(user1.address);
    const _amount = user_iGAMMA_bal + BigInt(1);
    await expect(infinityVault.startUnstake(_amount)).to.be.revertedWith(
      "unstakeTokenAmount should be less than or equal to amount of iGAMMA user can unstake more");
  })

  it("Give entire iGAMMA for unstaking",async function() {
    const iGAMMA_bal = await infinityVault.balanceOf(user1.address);
    await infinityVault.connect(user1).startUnstake(iGAMMA_bal);
  })

  it("should print user unstaking info",async function() {
    const user_info = await infinityVault.userInfo(user1.address);
    console.log("\n",user_info);
  })

});


describe("TEST CLAIM",function() {

  it("TEST CLAIM BEFORE MIN WITHDRAW TIME",async function() {
    await expect(infinityVault.claimAfterUnstakeTimeLimit()).to.be.revertedWith("too early");
  });

  // it("TEST CLAIM INSTANTLY",async function() {
  //   const userInfo = await infinityVault.userInfo(user1.address);
  //   const exchangeRate = await infinityVault.iTokenExchangeRate();
  //   const amount_of_igamma_burn = userInfo['amountToBeUnstaked'];
  //   const amount_of_ggamma_withdrawed = BigInt(amount_of_igamma_burn) * BigInt(exchangeRate) / BigInt(1e18);
    
  //   const newTotalSupply = BigInt(await infinityVault.totalSupply()) - BigInt(amount_of_igamma_burn);
  //   const fee =  BigInt(amount_of_ggamma_withdrawed) * BigInt(await infinityVault.instantWithdrawFee()) / BigInt(10000);
  //   const user1NewGgamma_bal = BigInt(await gToken.balanceOf(user1.address)) + amount_of_ggamma_withdrawed - fee

  //   await infinityVault.claimInstantly();

  //   const user_info = await infinityVault.userInfo(user1.address);
  //   console.log("\n",user_info);
  //   //console.log("TOTAL GGAMMA WITHDRAWED",amount_of_ggamma_withdrawed);
  //   //console.log("\n","WITHDRAW FEE ADDRESS GGAMMA BALANCE",await gToken.balanceOf(await infinityVault.withdrawFeeAddress()))

  //   expect(await infinityVault.totalSupply()).to.equal(newTotalSupply);
  //   expect(await gToken.balanceOf(await infinityVault.withdrawFeeAddress())).to.equal(fee);
  //   expect(await gToken.balanceOf(user1.address)).to.equal(user1NewGgamma_bal);

  // });

  it("TEST CLAIM AFTER MIN WITHDRAW TIME",async function() {
    
    const time = 21 * 24 * 60 * 60
    await network.provider.send("evm_increaseTime", [time])
    await network.provider.send("evm_mine")
    
    const userInfo = await infinityVault.userInfo(user1.address);
    const exchangeRate = await infinityVault.iTokenExchangeRate();
    const amount_of_igamma_burn = userInfo['amountToBeUnstaked'];
    const amount_of_ggamma_withdrawed = BigInt(amount_of_igamma_burn) * BigInt(exchangeRate) / BigInt(1e18);
    
    const newTotalSupply = BigInt(await infinityVault.totalSupply()) - BigInt(amount_of_igamma_burn);
    const fee =  BigInt(amount_of_ggamma_withdrawed) * BigInt(await infinityVault.normalWithdrawFee()) / BigInt(10000);
    const user1NewGgamma_bal = BigInt(await gToken.balanceOf(user1.address)) + amount_of_ggamma_withdrawed - fee

    await infinityVault.claimAfterUnstakeTimeLimit();

    const user_info = await infinityVault.userInfo(user1.address);
    console.log("\n",user_info);

    expect(await infinityVault.totalSupply()).to.equal(newTotalSupply);
    expect(await gToken.balanceOf(await infinityVault.withdrawFeeAddress())).to.equal(fee);
    expect(await gToken.balanceOf(user1.address)).to.equal(user1NewGgamma_bal);

  });

});


describe("TEST CHANGING WITHDRAW FEE ADDRESS",function () {

  it("should revert with `_newWithdrawFeeAddress should no be zero address`",async function() {
    await expect(infinityVault.changeWithdrawFeeAddress(zeroAddress)).to.be.revertedWith("newWithdrawFeeAddress should no be zero address");
  });

  it("should revert with `Ownable: caller is not the owner`",async function() {
    await expect(infinityVault.connect(user2).changeWithdrawFeeAddress(zeroAddress)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should change the withdraw fee address`",async function() {
    await infinityVault.changeWithdrawFeeAddress(user2.address);
    expect(await infinityVault.withdrawFeeAddress()).to.equal(user2.address);
  });

});

describe("TEST CHANGING PERFORMANCE FEE ADDRESS",function () {

  it("should revert with `_newPerformanceFeeAddress should no be zero address`",async function() {
    await expect(infinityVault.changePerformanceFeeAddress(zeroAddress)).to.be.revertedWith("_newPerformanceFeeAddress should no be zero address");
  });

  it("should revert with `Ownable: caller is not the owner`",async function() {
    await expect(infinityVault.connect(user2).changePerformanceFeeAddress(zeroAddress)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should change the performance fee address`",async function() {
    await infinityVault.changePerformanceFeeAddress(user3.address);
    expect(await infinityVault.performanceFeeAddress()).to.equal(user3.address);
  });

});

describe("TEST SETSETTINGS",function () {

  const normalFee = BigInt(400);
  const instantFee = BigInt(800);
  const performanceFee = BigInt(2000)

  it("should revert with `_normalWithdrawFee too high`",async function() {
    await expect(infinityVault.setSettings(600,instantFee,performanceFee)).to.be.revertedWith("_normalWithdrawFee too high");
  });

  it("should revert with `_instantWithdrawFee too high`",async function() {
    await expect(infinityVault.setSettings(normalFee,1100,performanceFee)).to.be.revertedWith("_instantWithdrawFee too high");
  });

  it("should revert with `_performanceFee too high`",async function() {
    await expect(infinityVault.setSettings(normalFee,instantFee,3000)).to.be.revertedWith("_performanceFee too high");
  });

  it("should revert with `Ownable: caller is not the owner`",async function() {
    await expect(infinityVault.connect(user2).setSettings(normalFee,instantFee,performanceFee)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should change the new normal,instant, performance fee`",async function() {
    await infinityVault.setSettings(normalFee,instantFee,performanceFee);
    expect(await infinityVault.normalWithdrawFee()).to.equal(normalFee);
    expect(await infinityVault.instantWithdrawFee()).to.equal(instantFee);
    expect(await infinityVault.performanceFee()).to.equal(performanceFee);
  });

});


describe("TEST SET MIN TIME TO WITHDRAW",function() {

  const minTimeToWithdraw = BigInt(22 * 24 * 60 * 60);
  const wrongMinTimeToWithdraw = BigInt(40 * 24 * 60 * 60);

  it("should revert with `too high",async function() {
    await expect(infinityVault.setMinTimeToWithdraw(wrongMinTimeToWithdraw)).to.be.revertedWith("too high");
  });

  it("should revert with `Ownable: caller is not the owner",async function() {
    await expect(infinityVault.connect(user2).setMinTimeToWithdraw(minTimeToWithdraw)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it(`should change the min time to draw to ${minTimeToWithdraw}`,async function() {
    await infinityVault.setMinTimeToWithdraw(minTimeToWithdraw);
    expect(await infinityVault.minTimeToWithdraw()).to.equal(minTimeToWithdraw);
  });

});


