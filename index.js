const express = require("express");
const app = express();

const env = require("dotenv").config();
const Web3 = require('web3');
// const bridgeABI = require('./abi/bridgeABI.json');
const ethBridgeABI = require('./abi/ethBridgeABI.json');
const bscBridgeABI = require('./abi/bscBridgeABI.json');
const springABI = require('./abi/springABI.json');

const etherProvider = new Web3.providers.WebsocketProvider(process.env.ETHER_RPC);
const bscProvider = new Web3.providers.WebsocketProvider(process.env.BSC_RPC);

const etherWeb3 = new Web3(etherProvider);
const bscWeb3 = new Web3(bscProvider);
const pvKey = process.env.PRIVATE_KEY;
const myAccount = etherWeb3.eth.accounts.privateKeyToAccount(pvKey).address;
// bridge contract
const etherBridgeAddress = process.env.ETHER_BRDIGE_ADDRESS;
const etherBridge = new etherWeb3.eth.Contract(ethBridgeABI, etherBridgeAddress);

const bscBridgeAddress = process.env.BSC_BRDIGE_ADDRESS;
const bscBridge = new bscWeb3.eth.Contract(bscBridgeABI, bscBridgeAddress);

// Season contract
const etherSpringAddr = process.env.ETHER_SPRING_TOKEN;
const bscSpringAddr = process.env.BSC_SPRING_TOKEN;
const bscSpring = new bscWeb3.eth.Contract(springABI, bscSpringAddr);

async function bscFinalizeSwap(result){
  const token = result.token;
  const amount = result.amount;
  const fromWallet = result.from;
  console.log("From : ", fromWallet);
  let bscSeason;
  let bscSeasonAddr;
  switch(token){
    case etherSpringAddr:
        bscSeason = bscSpring;
        bscSeasonAddr = bscSpringAddr;
        console.log("Swapping Spring Token");
      break;
    // case etherSpringAddr:
    //   bscSeason = bscSpring;
    //   break;
    // case etherSpringAddr:
    //   bscSeason = bscSpring;
    //   break;
    // case etherSpringAddr:
    //   bscSeason = bscSpring;
    //   break;
  }
  const data = await bscSeason.methods.mint(fromWallet, amount);
  const encodedABI = data.encodeABI();
  const signedTx = await bscWeb3.eth.accounts.signTransaction(
    {
        from: myAccount, 
        to: bscSeasonAddr, 
        data: encodedABI,
        gas: 100000,
        value: 0,
    },
    pvKey
  );
  try {
      const success = await bscWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log("Finished");
  } catch (e) {
      console.log(e);
  }
}

async function etherFinalizeSwap(result){
  const token = result.token;
  const amount = result.amount;
  const fromWallet = result.from;
  console.log("From : ", fromWallet);
  let etherSeasonAddr;
  switch(token){
    case bscSpringAddr:
      etherSeasonAddr = etherSpringAddr;
      break;
    // case bscSpringAddr:
    //   etherSeasonAddr = etherSpringAddr;
    //   break;
    // case bscSpringAddr:
    //   etherSeasonAddr = etherSpringAddr;
    //   break;
    // case bscSpringAddr:
    //   etherSeasonAddr = etherSpringAddr;
    //   break;
  }
  const data = await etherBridge.methods.acceptSwapFromBsc(fromWallet, etherSeasonAddr, amount);
  const encodedABI = data.encodeABI();
  const signedTx = await etherWeb3.eth.accounts.signTransaction(
    {
        from: myAccount, 
        to: etherSeasonAddr, 
        data: encodedABI,
        gas: 100000,
        value: 0,
    },
    pvKey
  );
  console.log("Transfer EtherSprint to Account");
  try {
      const success = await etherWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log("Finished");
  } catch (e) {
      console.log(e);
  }
}

etherBridge.events.SwappedFromEth({
  filter: {tokenAddr: etherSpringAddr}})
  .on('data', function(event){
    console.log('event: Swap from ETH');
    bscFinalizeSwap(event.returnValues);
  })
  .on('error', console.error);

bscBridge.events.SwappedFromBsc()
  .on('data', function(event){
    console.log('event: Swap from BSC');
    etherFinalizeSwap(event.returnValues);
  })
  .on('error', console.error);



const port = parseInt(process.env.PORT || 3000);

app.listen(port, ()=> {
  console.log(`Server running on port ${port}`);
});
