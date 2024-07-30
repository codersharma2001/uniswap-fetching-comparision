import { ethers } from "ethers";
import { request, gql } from 'graphql-request';
import IUniswapV3Pool from './UniswapV3Pool.json' assert { type: 'json' };
import QuoterABI from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json" assert { type: 'json' };
import { Token } from "@uniswap/sdk-core";
import JSBI from "jsbi";

const provider = new ethers.providers.JsonRpcProvider(
  "https://eth-mainnet.g.alchemy.com/v2/xnNWnpBMlZABF_rBFjTf2aKBL-N3RkJN"
);

const UNISWAP_V3_POOL_ADDRESS = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"; 
const UNISWAP_V3_SUBGRAPH_URL = 'https://gateway-arbitrum.network.thegraph.com/api/99496d0f2789c06f1dda18e208f866a6/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
const SLIPPAGE_TOLERANCE = 0.01; 

async function getPoolState(poolContract) {
  const liquidity = await poolContract.liquidity();
  const slot = await poolContract.slot0();
  return {
      liquidity: JSBI.BigInt(liquidity.toString()),
      sqrtPriceX96: JSBI.BigInt(slot[0].toString()),
      tick: slot[1],
  };
}

function getExecutionPrice(sqrtPriceX96, decimals0, decimals1) {
  const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
  const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));
  const priceX192 = JSBI.multiply(sqrtPriceX96, sqrtPriceX96);
  const priceRatio = JSBI.toNumber(priceX192) / (JSBI.toNumber(Q192) * 10 ** 17);
  const price = priceRatio * (10 ** (decimals0 - decimals1));
  return price;
}

const fetchPricewithSDKcore = async (addressFrom, addressTo, humanValue) => {
  console.time("SDK-Core Data Fetch Time");

  const poolAddress = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"; // Example pool address for WETH/USDC

  const poolContract = new ethers.Contract(
      poolAddress,
      [
          "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
          "function liquidity() view returns (uint128)",
          "function token0() view returns (address)",
          "function token1() view returns (address)",
          "function fee() view returns (uint24)",
      ],
      provider
  );

  const state = await getPoolState(poolContract);

  const tokenFrom = new Token(1, addressFrom, 18, "WETH", "Wrapped Ether");
  const tokenTo = new Token(1, addressTo, 6, "USDC", "USD Coin");

  const executionPrice = getExecutionPrice(state.sqrtPriceX96, tokenFrom.decimals, tokenTo.decimals);

  const quotedAmountOut = executionPrice * parseFloat(humanValue);

  const slippageMultiplier = ethers.BigNumber.from((1 + SLIPPAGE_TOLERANCE).toFixed(6).replace('.', ''));
  const quotedAmountOutBN = ethers.BigNumber.from(Math.floor(quotedAmountOut * 1e6));
  const amountWithSlippage = quotedAmountOutBN
    .mul(slippageMultiplier)
    .div(ethers.BigNumber.from('1000000'));

  const formattedAmountWithSlippage = ethers.utils.formatUnits(amountWithSlippage, 6);
  console.timeEnd("SDK-Core Data Fetch Time");
  return {
    quotedAmountOut: quotedAmountOut.toFixed(6),
    amountWithSlippage: formattedAmountWithSlippage
  };
};

async function fetchusingContractData() {
  console.time("Contract Data Fetch Time");
  const poolContract = new ethers.Contract(UNISWAP_V3_POOL_ADDRESS, IUniswapV3Pool, provider);
  const slot0 = await poolContract.slot0();
  const liquidity = await poolContract.liquidity();
  const sqrtPriceX96 = slot0.sqrtPriceX96;

  const price = ethers.BigNumber.from(sqrtPriceX96)
    .mul(ethers.BigNumber.from(sqrtPriceX96))
    .mul(ethers.BigNumber.from(10).pow(6)) 
    .div(ethers.BigNumber.from(2).pow(192));

  const amountWETH = ethers.BigNumber.from(10).mul(ethers.BigNumber.from(10).pow(18)); 
  const priceOf10WETHInUSDC = price.mul(amountWETH).div(ethers.BigNumber.from(10).pow(23));
  
  const priceWithSlippage = price.mul(ethers.BigNumber.from((1 + SLIPPAGE_TOLERANCE) * 1e6)).div(1e6);
  const priceOf10WETHInUSDCWithSlippage = priceWithSlippage.mul(amountWETH).div(ethers.BigNumber.from(10).pow(23));

  const data = {
    liquidity: ethers.utils.formatUnits(liquidity, 18), 
    priceOf10WETHInUSDC: ethers.utils.formatUnits(priceOf10WETHInUSDC, 6), 
    priceOf10WETHInUSDCWithSlippage: ethers.utils.formatUnits(priceOf10WETHInUSDCWithSlippage, 6) 
  };
  console.timeEnd("Contract Data Fetch Time");
  return data;
}

async function fetchusingSdkData() {
  console.time("SDK-Quoter Data Fetch Time");
  const addressFrom = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; 
  const addressTo = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; 

  const humanValue = "10";
  const QUOTER_CONTRACT_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

  const quoterContract = new ethers.Contract(
    QUOTER_CONTRACT_ADDRESS,
    QuoterABI.abi,
    provider
  );
  const amountIn = ethers.utils.parseUnits(humanValue, 18);
  const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
    addressFrom,
    addressTo,
    3000,
    amountIn.toString(),
    0
  );
  const amount = ethers.utils.formatUnits(quotedAmountOut.toString(), 6);

  const amountWithSlippage = ethers.BigNumber.from(quotedAmountOut)
    .mul(ethers.BigNumber.from((1 - SLIPPAGE_TOLERANCE) * 1e6))
    .div(1e6);

  console.timeEnd("SDK-Quoter Data Fetch Time");
  return {
    amount,
    amountWithSlippage: ethers.utils.formatUnits(amountWithSlippage.toString(), 6)
  };
}

// Fetching data from the subgraph
const Query = gql`
query getPoolData($poolAddress: String!) {
  pool(id: $poolAddress) {
    tick
    token0 {
      id
      symbol
      name
      decimals
    }
    token1 {
      id
      symbol
      name
      decimals
    }
    liquidity
    sqrtPrice
  }
}
`;

const fetchPoolData = async (poolAddress) => {
  try {
    const variables = { poolAddress: UNISWAP_V3_POOL_ADDRESS.toLowerCase() };
    const response = await request(UNISWAP_V3_SUBGRAPH_URL, Query, variables);
    const pool = response.pool;
    const token0 = pool.token0;
    const token1 = pool.token1;
    const fee = pool.feeTier;
    const liquidity = pool.liquidity;
    const sqrtPriceX96 = pool.sqrtPrice;
    const tick = pool.tick;

    const price = ethers.BigNumber.from(sqrtPriceX96)
      .mul(ethers.BigNumber.from(sqrtPriceX96))
      .mul(ethers.BigNumber.from(10).pow(token0.decimals)) 
      .div(ethers.BigNumber.from(2).pow(192));

    const amountWETH = ethers.BigNumber.from(10).mul(ethers.BigNumber.from(10).pow(token1.decimals)); 
    const priceOf10WETHInUSDC = price.mul(amountWETH).div(ethers.BigNumber.from(10).pow(23));
    
    const priceWithSlippage = price.mul(ethers.BigNumber.from((1 + SLIPPAGE_TOLERANCE) * 1e6)).div(1e6);
    const priceOf10WETHInUSDCWithSlippage = priceWithSlippage.mul(amountWETH).div(ethers.BigNumber.from(10).pow(23));
 
    return {
      poolAddress,
      token0,
      token1,
      liquidity,
      sqrtPriceX96,
      tick,
      priceOf10WETHInUSDC: ethers.utils.formatUnits(priceOf10WETHInUSDC, token0.decimals), 
      priceOf10WETHInUSDCWithSlippage: ethers.utils.formatUnits(priceOf10WETHInUSDCWithSlippage, token0.decimals) 
    };
  } catch (error) {
    console.error("Error fetching pool data:", error);
  }
};

async function fetchusingSubgraphData() {
  console.time("Subgraph Data Fetch Time");
  const poolData = await fetchPoolData(UNISWAP_V3_POOL_ADDRESS);
  console.timeEnd("Subgraph Data Fetch Time");
  return poolData;
}

async function main() {
  const addressFrom = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
  const addressTo = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC
  const humanValue = "10";
  const [contractData, sdkData, subgraphData , sdkCoreData] = await Promise.all([
    fetchusingContractData(),
    fetchusingSdkData(),
    fetchusingSubgraphData(),
    fetchPricewithSDKcore(addressFrom, addressTo, humanValue)
  ]);

  console.log("Contract Data:", contractData);
  console.log("SDK Data:", sdkData);
  console.log("Subgraph Data:", subgraphData);
  console.log("SDK Core Data:", sdkCoreData);
}

main().catch(console.error);
