import { ethers } from "ethers";
import { Token } from "@uniswap/sdk-core";
import JSBI from "jsbi";

const provider = new ethers.providers.JsonRpcProvider(
    "https://eth-mainnet.g.alchemy.com/v2/xnNWnpBMlZABF_rBFjTf2aKBL-N3RkJN"
);

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

const fetchPrice = async (addressFrom, addressTo, humanValue) => {
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
    console.log(`Execution Price: ${executionPrice.toFixed(6)}`);


    const quotedAmountOut = executionPrice.toFixed(6) * parseFloat(humanValue);
    console.log(`Quoted Amount Out: ${quotedAmountOut} ${tokenTo.symbol}`);

    return quotedAmountOut;
};

const main = async () => {
    const addressFrom = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH
    const addressTo = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC

    const humanValue = "10";
    const result = await fetchPrice(addressFrom, addressTo, humanValue);
    console.log(`Quoted Amount Out: ${result} USDC`);
};

main().catch(console.error);
