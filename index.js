const express = require("express");
const app = express();

const env = require("dotenv").config();
const Web3 = require('web3');
// const bridgeABI = require('./abi/bridgeABI.json');
const ethBridgeABI = require('./abi/ethBridgeABI.json');
const bscBridgeABI = require('./abi/bscBridgeABI.json');
const springABI = require('./abi/springABI.json');
const summerABI = require('./abi/summerABI.json');
const autumnABI = require('./abi/autumnABI.json');
const winterABI = require('./abi/winterABI.json');

const etherProvider = new Web3.providers.WebsocketProvider(process.env.ETHER_RPC);
const bscProvider = new Web3.providers.WebsocketProvider(process.env.BSC_RPC);

const etherWeb3 = new Web3(etherProvider);
const bscWeb3 = new Web3(bscProvider);
const pvKey = process.env.PRIVATE_KEY;
const myAccount = etherWeb3.eth.accounts.privateKeyToAccount(pvKey).address;
// bridge contract
const etherBridgeAddress = "0x3E197a606969A8B8c1e426B3421Cf8574ac4431C";
const etherBridge = new etherWeb3.eth.Contract(ethBridgeABI, etherBridgeAddress);

const bscBridgeAddress = "0x15472FDC8799FC851B1eE0e6604190F475Fd707b";
const bscBridge = new bscWeb3.eth.Contract(bscBridgeABI, bscBridgeAddress);

// Season contract
const etherSpringAddr = "0x2eC6D1d29E0F0C34Ae63b06670EbcC5eF3725e92";
const etherSummerAddr = "0xffE9541a416700fe70A404bcCf3Ae444388A36E1";
const etherAutumnAddr = "0x8E05426A0c272D8963761F1Bcf947d06D51F2C3F";
const etherWinterAddr = "0xCd090BB2444bb039878a769F62965F6FA268b178";

const bscSpringAddr = "0x79BE19FF38cB4EB83D0A1B0D1Fa6eCE81df0D9e1";
const bscSummerAddr = "0x51E5e7504B9349De3d8529F087aea8b0A5f5bdF4";
const bscAutumnAddr = "0x53Ce052eA436C554f11c1dD92970A7C64A86fb52";
const bscWinterAddr = "0x21a7e1CdcEe222e91E34633b9fdEdbeAA4b301DB";

const bscSpring = new bscWeb3.eth.Contract(springABI, bscSpringAddr);
const bscSummer = new bscWeb3.eth.Contract(summerABI, bscSummerAddr);
const bscAutumn = new bscWeb3.eth.Contract(autumnABI, bscAutumnAddr);
const bscWinter = new bscWeb3.eth.Contract(winterABI, bscWinterAddr);

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
    case etherSummerAddr:
      bscSeason = bscSummer;
      bscSeasonAddr = bscSummerAddr;
      console.log("Swapping Summer Token");
      break;
    case etherAutumnAddr:
      bscSeason = bscAutumn;
      bscSeasonAddr = bscAutumnAddr;
      console.log("Swapping Autumn Token");
      break;
    case etherWinterAddr:
      bscSeason = bscWinter;
      bscSeasonAddr = bscWinterAddr;
      console.log("Swapping Winter Token");
      break;
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
      console.log("Swapping Spring Token");
      break;
    case bscSummerAddr:
      etherSeasonAddr = etherSummerAddr;
      console.log("Swapping Summer Token");
      break;
    case bscAutumnAddr:
      etherSeasonAddr = etherAutumnAddr;
      console.log("Swapping Autumn Token");
      break;
    case bscWinterAddr:
      etherSeasonAddr = etherWinterAddr;
      console.log("Swapping Winter Token");
      break;
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
