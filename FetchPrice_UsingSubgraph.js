import { request, gql } from 'graphql-request';

const UNISWAP_V3_SUBGRAPH_URL = 'https://gateway-arbitrum.network.thegraph.com/api/99496d0f2789c06f1dda18e208f866a6/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';

const GET_POOL_DATA = gql`
  query getPoolData($poolAddress: String!) {
    pool(id: $poolAddress) {
      id
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
      feeTier
      liquidity
      sqrtPrice
      tick
    }
  }
`;


const fetchPoolData = async (poolAddress) => {
  try {
    const variables = { poolAddress: poolAddress.toLowerCase() };
    const response = await request(UNISWAP_V3_SUBGRAPH_URL, GET_POOL_DATA, variables);
    const pool = response.pool;

    
    const token0 = pool.token0;
    const token1 = pool.token1;
    const fee = pool.feeTier;
    const liquidity = pool.liquidity;
    const sqrtPriceX96 = pool.sqrtPrice;
    const tick = pool.tick;

    return {
      poolAddress,
      token0,
      token1,
      fee,
      liquidity,
      sqrtPriceX96,
      tick,
    };
  } catch (error) {
    console.error("Error fetching pool data:", error);
  }
};

const main = async () => {
  const poolAddress = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"; 

  const poolData = await fetchPoolData(poolAddress);
  console.log("Pool Data:", poolData);
};

main().catch(console.error);
