const https = require("https");
const fs = require('fs');

const express = require("express");
const app = express();

const env = require("dotenv").config();
const Web3 = require('web3');
const cors = require("cors");
const socket = require("socket.io");

// const bridgeABI = require('./abi/bridgeABI.json');
const ethBridgeABI = require('./abi/ethBridgeABI.json');
const bscBridgeABI = require('./abi/bscBridgeABI.json');
const seasonalABI = require('./abi/springABI.json');

const etherProvider = new Web3.providers.WebsocketProvider(process.env.ETHER_RPC);
const bscProvider = new Web3.providers.WebsocketProvider(process.env.BSC_RPC);

const ethWeb3 = new Web3(etherProvider);
const bscWeb3 = new Web3(bscProvider);
const pvKey = process.env.PRIVATE_KEY;
const myAccount = ethWeb3.eth.accounts.privateKeyToAccount(pvKey).address;
// bridge contract
const etherBridgeAddress = "0x9d593299cf32410045D114C3C18a68ACEECDD3f7";
const etherBridge = new ethWeb3.eth.Contract(ethBridgeABI, etherBridgeAddress);

const bscBridgeAddress = "0xA2E1136d323896eD56F15ff85b9C73C6DdC98a96";
const bscBridge = new bscWeb3.eth.Contract(bscBridgeABI, bscBridgeAddress);

// Season contract
const etherSpringAddr = "0xf04aF3f4E4929F7CD25A751E6149A3318373d4FE";
const etherSummerAddr = "0x4D4f3715050571A447FfFa2Cd4Cf091C7014CA5c";
const etherAutumnAddr = "0x4c3bAe16c79c30eEB1004Fb03C878d89695e3a99";
const etherWinterAddr = "0xCcbA0b2bc4BAbe4cbFb6bD2f1Edc2A9e86b7845f";

const bscSpringAddr = "0x8d725B8848cf9C971Fa8991cbDeE2e1a35ac9DeC";
const bscSummerAddr = "0x21B174B45f930C1b5E34b5066C95d4dBe23Ef421";
const bscAutumnAddr = "0xec964DeE5172d86A0188B992B1F5603DE947f41b";
const bscWinterAddr = "0x8080821eec2B90Bc18dd7Fd9D5Fc7c3F820EB7e9";

const bscSpring = new bscWeb3.eth.Contract(seasonalABI, bscSpringAddr);
const bscSummer = new bscWeb3.eth.Contract(seasonalABI, bscSummerAddr);
const bscAutumn = new bscWeb3.eth.Contract(seasonalABI, bscAutumnAddr);
const bscWinter = new bscWeb3.eth.Contract(seasonalABI, bscWinterAddr);

app.use(express());
app.use(cors());

var options = {
  key: fs.readFileSync('sslcert/server.key', 'utf8'),
  cert: fs.readFileSync('sslcert/server.crt', 'utf8')
};

const port = parseInt(process.env.PORT || 3000);
const server = https.createServer(options, app).listen(port, ()=> {
  console.log(`Server running on port ${port}`);
});

let webSocket = null;
try {
  webSocket = socket(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  webSocket.on("connection", (socket) => {
    socket.on('TestNetworkConnections', async () => {
      try{
        const ethSpring = new ethWeb3.eth.Contract(seasonalABI, etherSpringAddr);
        const testEth = await ethSpring.methods.balanceOf(etherBridgeAddress).call();
        const testBsc = await bscSpring.methods.balanceOf(bscBridgeAddress).call();
        webSocket.emit('NetworksAreActive');
      } catch(e) {
        console.log('test network error:', e);
        webSocket.emit('error', {error:e});
      }
    });
  });
} catch(e) {
  console.log(e);
}

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
      await bscWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log("Finished");
      webSocket.emit('Swap Finished');
  } catch (e) {
      console.log(e);
      webSocket.emit('error',{error: e});
  }

}

async function etherFinalizeSwap(result){
  const token = result.token;
  const amount = result.amount;
  const fromWallet = result.from;
  console.log("From : ", fromWallet);
  let etherSeasonAddr;
  switch(token) {
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
  const signedTx = await ethWeb3.eth.accounts.signTransaction(
    {
        from: myAccount,
        to: etherBridgeAddress,
        data: encodedABI,
        gas: 100000,
        value: 0,
    },
    pvKey
  );
  try {
      await ethWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
      console.log("Finished");
      webSocket.emit('Swap Finished');
  } catch (e) {
      console.log(e);
      webSocket.emit('error', {error: e});
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
    // console.log(event);
    etherFinalizeSwap(event.returnValues);
  })
  .on('error', console.error);




// app.get('/ws', (req, res) => {
//   res.send('Hello World!')
// })