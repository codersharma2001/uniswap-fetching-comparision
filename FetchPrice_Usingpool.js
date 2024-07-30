import { ethers } from "ethers";
import { abi as PoolABI } from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";

const ERC20ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];

// Replace with your own Alchemy or Infura API key
const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/xnNWnpBMlZABF_rBFjTf2aKBL-N3RkJN");

// Fetch token data
const fetchTokenData = async (tokenAddress) => {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const name = await tokenContract.name();
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const totalSupply = await tokenContract.totalSupply();
    return {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString()
    };
};

// Fetch pool data
const fetchPoolData = async (poolAddress) => {
    const poolContract = new ethers.Contract(poolAddress, PoolABI, provider);

    const token0Address = await poolContract.token0();
    const token1Address = await poolContract.token1();
    
    const token0 = await fetchTokenData(token0Address);
    const token1 = await fetchTokenData(token1Address);
    
    console.log("Token 1", token0);
    console.log("Token 2", token1);
    const fee = await poolContract.fee();
    
    console.log("Fee --> " , fee);
    // Fetch liquidity
    const liquidity = await poolContract.liquidity();
    console.log("Fetched Liquidity --> " , liquidity);
    // Fetch slot0 data which includes current price, tick, etc.
    const slot0 = await poolContract.slot0();
    console.log("Slot0 :" , slot0);
    return {
        poolAddress,
        token0,
        token1,
        fee,
        liquidity: liquidity.toString(),
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        tick: slot0.tick,
        observationIndex: slot0.observationIndex,
        observationCardinality: slot0.observationCardinality,
        observationCardinalityNext: slot0.observationCardinalityNext,
        feeProtocol: slot0.feeProtocol,
        unlocked: slot0.unlocked,
    };
};

const main = async () => {
    const poolAddress = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"; // WETH/BNB pool address

    const poolData = await fetchPoolData(poolAddress);
    console.log("Pool Data:", poolData);
};

main().catch(console.error);
