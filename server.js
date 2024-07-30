const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { abi: PoolABI } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');
const ERC20ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];

const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/xnNWnpBMlZABF_rBFjTf2aKBL-N3RkJN");

const app = express();
const port = 3000;

app.use(bodyParser.json());

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

const fetchPoolData = async (token0Address, token1Address) => {
  const factory = new ethers.Contract(
    '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 factory address
    [
      'function getPool(address,address,uint24) view returns (address)',
      'function feeAmountTickSpacing(uint24) external view returns (int24)',
    ],
    provider
  );

  const feeTier = 3000;
  const poolAddress = await factory.getPool(token0Address, token1Address, feeTier);

  if (poolAddress === ethers.constants.AddressZero) {
    throw new Error('Pool not found');
  }

  const poolContract = new ethers.Contract(poolAddress, PoolABI, provider);

  const fee = await poolContract.fee();

  const liquidity = await poolContract.liquidity();

  const slot0 = await poolContract.slot0();

  return {
    poolAddress,
    token0Address,
    token1Address,
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

const calculatePrice = (sqrtPriceX96, decimals0, decimals1) => {
  const price = (Math.pow(sqrtPriceX96 / Math.pow(2, 96), 2) * Math.pow(10, decimals1)) / Math.pow(10, decimals0);
  return price;
};

app.post('/price', async (req, res) => {
  try {
    const { sellTokenAddress, buyTokenAddress, sellTokenAmount, user, quote_id, isPermit2 } = req.body;

    if (!sellTokenAddress || !buyTokenAddress || !sellTokenAmount || !user || !quote_id) {
      return res.status(400).send('Missing required fields');
    }

    const token0 = await fetchTokenData(sellTokenAddress);
    const token1 = await fetchTokenData(buyTokenAddress);

    const poolData = await fetchPoolData(sellTokenAddress, buyTokenAddress);

    const price = calculatePrice(poolData.sqrtPriceX96, token0.decimals, token1.decimals);
    const sellAmountInUnits = ethers.utils.formatUnits(sellTokenAmount, token0.decimals);
    const buyTokenAmountInUnits = sellAmountInUnits * price;
    const buyTokenAmount = ethers.utils.parseUnits(buyTokenAmountInUnits.toFixed(token1.decimals), token1.decimals);

    const response = {
      user,
      quote_id,
      isPermit2,
      sellTokenAddress,
      buyTokenAddress,
      sellTokenAmount,
      price,
      buyTokenAmount : buyTokenAmount.toString(),
      typeData: {
        token0,
        token1,
        poolData
      }
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching pool data');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
