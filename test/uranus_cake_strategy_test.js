const { expect } = require("chai");
const { ethers } = require("hardhat");
const strategy_params = require("../cake_strategy_params.json");
const params = strategy_params[0];

//Account To Impersonate
const ownersAccount = "0xFd525F21C17f2469B730a118E0568B4b459d61B9"; //DALLAS Account

const cake_token_holder = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
const want = params[0][4];
const depositAmount  = BigInt(100e18);
const withdrawAmount = BigInt(10e18);

const farm_Address = "0xB87F7016585510505478D1d160BDf76c1f41b53d";

let user1;
let user2;
let owner;
let strategy;
let pool_id;
let pending_gamma_in_old_cake_strat;
let pending_gamma_in_new_cake_strat;

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

describe("STRATEGY CONTRACT DEPLOYMENT", function () {
  
  it("Should Deploy Strategy", async function () {
    
    [user1,user2] = await ethers.getSigners();
    owner = await ethers.getSigner(ownersAccount);
    const Strategy = await ethers.getContractFactory("contracts/uranus_cake_strategy_old.sol:GammaStrategy_Uranus");
    strategy = await Strategy.deploy(
      params[0],
      params[1],
      params[2],
      params[3],
      params[4],
      params[5],
      params[6],
      params[7],
      params[8],
      params[9],
      params[10],
      params[11],
      params[12],
      params[13],
      params[14],
    );

  });

});

describe("ADD DEPLOYED STRATEGY TO THE FARM",function(){

  it("should revert with `Ownable: caller is not the owner`",async function () {

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);

    pool_id = Number(await farm.poolLength());

    const tx = farm.add(0,want,false,strategy.address);

    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");

  })

  it("should add the new pool into the farm",async() => {
    
    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner.address],
    });

    await farm.connect(owner).add(0,want,false,strategy.address);

    //close impersonating
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [owner.address],
    });

  });

})

describe("TRANSFER CAKE BALANCE INTO THE USER2 account",function(){

  it("should transfer and check the cake balance of `cake_token_holder` address to user2`",async function () {

    const cake_inst = await ethers.getContractAt("contracts/aqua.sol:AQUA",want);

    const cake_token_holder_cake_bal = (await cake_inst.balanceOf(cake_token_holder));

    if(cake_token_holder_cake_bal > 0){
      
      const signer = await ethers.getSigner(cake_token_holder);

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [signer.address],
      });
  
      await cake_inst.connect(signer).transfer(user2.address,cake_token_holder_cake_bal);
  
      //close impersonating
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [signer.address],
      });
      
      const user2_cake_token_bal = (await cake_inst.balanceOf(user2.address));

      expect(cake_token_holder_cake_bal).to.equal(user2_cake_token_bal);
    }

  })

})

describe(`DEPOSIT ${depositAmount/BigInt(1e18)} CAKE in new pool`,function(){

  it("should approve the farm to spend user2 want tokens",async function() {

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    const info = await farm.poolInfo(pool_id);
    const want = info['want'];

    const want_inst = await ethers.getContractAt("contracts/aqua.sol:AQUA",want);
    const allowance = await want_inst.allowance(user2.address,farm_Address);

    if(depositAmount > allowance){
      await want_inst.connect(user2).approve(farm_Address,BigInt(Math.pow(2,256)) - BigInt(1));
    }

  });

  it(`should deposit user2 ${depositAmount/BigInt(1e18)} CAKE `,async function() {

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    await farm.connect(user2).deposit(pool_id,depositAmount);
    
  });

  it(`should deposit user2 ${depositAmount/BigInt(1e18)} CAKE AGAIN AFTER 1 hour`,async function() {
    
    // console.log("\n BLOCK NUMBER BEFORE MINING",await ethers.provider.getBlockNumber());
    for(let  i = 0 ; i < 1200 ; i++){
      await network.provider.send("evm_mine")
    }
    // console.log("\n BLOCK NUMBER AFTER MINING",await ethers.provider.getBlockNumber());

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    await farm.connect(user2).deposit(pool_id,depositAmount);
    
  });

})

describe(`TEST WITHDRAW ${withdrawAmount/BigInt(1e18)} WANT TOKENS`,function() {
  
  // it("should print user2 pending gamma before mining blocks",async function() {
  //   console.log("PENDING GAMMA BEFORE MINING BLOCKS",(await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma);
  // });

  it("should mine block for 2hrs",async function() {  
    for(let  i = 0 ; i < 2400 ; i++){
      await network.provider.send("evm_mine")
    }
    // console.log("PENDING GAMMA AFTER MINING BLOCKS BEFORE WITHDRAW",(await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma);
  });

  it(`should withdraw ${withdrawAmount/BigInt(1e18)} WANT TOKENS`,async function() {
    
    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    await farm.connect(user2).withdraw(pool_id,withdrawAmount);

  });

  it("should print user2 pending gamma after withdraw after 1 block",async function() {
    for(let  i = 0 ; i < 1 ; i++){
      await network.provider.send("evm_mine")
    }
    pending_gamma_in_old_cake_strat = (await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma
    //console.log("PENDING GAMMA AFTER MINING 1 BLOCK AFTER WITHDRAW",(await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma);
  });

})


/********************************************COPY ABOVE CODE FOR NEW CAKE STRATEGY**************************************/






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

describe("STRATEGY CONTRACT DEPLOYMENT", function () {
  
  it("Should Deploy Strategy", async function () {
    
    [user1,user2] = await ethers.getSigners();
    owner = await ethers.getSigner(ownersAccount);
    const Strategy = await ethers.getContractFactory("contracts/uranus_cake_strategy_new.sol:GammaStrategy_Uranus");
    strategy = await Strategy.deploy(
      params[0],
      params[1],
      params[2],
      params[3],
      params[4],
      params[5],
      params[6],
      params[7],
      params[8],
      params[9],
      params[10],
      params[11],
      params[12],
      params[13],
      params[14],
    );

  });

});

describe("ADD DEPLOYED STRATEGY TO THE FARM",function(){

  it("should revert with `Ownable: caller is not the owner`",async function () {

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);

    pool_id = Number(await farm.poolLength());

    const tx = farm.add(0,want,false,strategy.address);

    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");

  })

  it("should add the new pool into the farm",async() => {
    
    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner.address],
    });

    await farm.connect(owner).add(0,want,false,strategy.address);

    //close impersonating
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [owner.address],
    });

  });

})

describe("TRANSFER CAKE BALANCE INTO THE USER2 account",function(){

  it("should transfer and check the cake balance of `cake_token_holder` address to user2`",async function () {

    const cake_inst = await ethers.getContractAt("contracts/aqua.sol:AQUA",want);

    const cake_token_holder_cake_bal = (await cake_inst.balanceOf(cake_token_holder));

    if(cake_token_holder_cake_bal > 0){
      
      const signer = await ethers.getSigner(cake_token_holder);

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [signer.address],
      });
  
      await cake_inst.connect(signer).transfer(user2.address,cake_token_holder_cake_bal);
  
      //close impersonating
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [signer.address],
      });
      
      const user2_cake_token_bal = (await cake_inst.balanceOf(user2.address));

      expect(cake_token_holder_cake_bal).to.equal(user2_cake_token_bal);
    }

  })

})

describe(`DEPOSIT ${depositAmount/BigInt(1e18)} CAKE in new pool`,function(){

  it("should approve the farm to spend user2 want tokens",async function() {

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    const info = await farm.poolInfo(pool_id);
    const want = info['want'];

    const want_inst = await ethers.getContractAt("contracts/aqua.sol:AQUA",want);
    const allowance = await want_inst.allowance(user2.address,farm_Address);

    if(depositAmount > allowance){
      await want_inst.connect(user2).approve(farm_Address,BigInt(Math.pow(2,256)) - BigInt(1));
    }

  });

  it(`should deposit user2 ${depositAmount/BigInt(1e18)} CAKE `,async function() {

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    await farm.connect(user2).deposit(pool_id,depositAmount);
    
  });

  it(`should deposit user2 ${depositAmount/BigInt(1e18)} CAKE AGAIN AFTER 1 hour`,async function() {
    
    // console.log("\n BLOCK NUMBER BEFORE MINING",await ethers.provider.getBlockNumber());
    for(let  i = 0 ; i < 1200 ; i++){
      await network.provider.send("evm_mine")
    }
    // console.log("\n BLOCK NUMBER AFTER MINING",await ethers.provider.getBlockNumber());

    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    await farm.connect(user2).deposit(pool_id,depositAmount);
    
  });

})

describe(`TEST WITHDRAW ${withdrawAmount/BigInt(1e18)} WANT TOKENS`,function() {
  
  // it("should print user2 pending gamma before mining blocks",async function() {
  //   console.log("PENDING GAMMA BEFORE MINING BLOCKS",(await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma);
  // });

  it("should mine block for 2hrs",async function() {  
    for(let  i = 0 ; i < 2400 ; i++){
      await network.provider.send("evm_mine")
    }
    // console.log("PENDING GAMMA AFTER MINING BLOCKS BEFORE WITHDRAW",(await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma);
  });

  it(`should withdraw ${withdrawAmount/BigInt(1e18)} WANT TOKENS`,async function() {
    
    const farm = await ethers.getContractAt("contracts/farm.sol:PlanetFinance",farm_Address);
    await farm.connect(user2).withdraw(pool_id,withdrawAmount);

  });

  it("should print user2 pending gamma after withdraw after 1 block",async function() {
    for(let  i = 0 ; i < 1 ; i++){
      await network.provider.send("evm_mine")
    }
    pending_gamma_in_new_cake_strat = (await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma
    //console.log("PENDING GAMMA AFTER MINING 1 BLOCK AFTER WITHDRAW",(await strategy.userPendingGammaProfit(user2.address)).pendingProfitInGamma);
  });

})


/**********************************************FINAL RESULTS ******************************************************/


describe(`PRINT PENDING GAMMA RESULTS FROM BOTH OLD AND NEW STRATEGIES`,function() {
  it("PRINT",async function(){
    console.log("\n PENDING GAMMA FOR OLD STRATEGY : ",pending_gamma_in_old_cake_strat);
    console.log("\n PENDING GAMMA FOR NEW STRATEGY : ",pending_gamma_in_new_cake_strat);
  })
})




