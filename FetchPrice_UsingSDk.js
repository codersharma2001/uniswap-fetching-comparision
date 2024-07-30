import { ethers } from "ethers";
import QuoterABI from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json" assert { type: "json" };

// ERC-20 ABI (minimal for fetching name, symbol, and decimals)
const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

const provider = new ethers.providers.JsonRpcProvider(
    "https://eth-mainnet.g.alchemy.com/v2/xnNWnpBMlZABF_rBFjTf2aKBL-N3RkJN"
);

const fetchPrice = async (addressFrom, addressTo, humanValue) => {
    const QUOTER_CONTRACT_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

    const quoterContract = new ethers.Contract(
        QUOTER_CONTRACT_ADDRESS,
        QuoterABI.abi,
        provider
    );
    const amountIn = ethers.utils.parseUnits("1", 18);
    const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
        addressFrom,
        addressTo,
        3000,
        amountIn.toString(),
        0
    );
    const amount = ethers.utils.formatUnits(quotedAmountOut.toString(), 18) * 10 ** 13;
    return amount;
};

const fetchTokenData = async (tokenAddress) => {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const name = await tokenContract.name();
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    return { name, symbol, decimals };
};

const main = async () => {
    const addressFrom = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; 
    const addressTo = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; 

    const humanValue = "10";
    const result = await fetchPrice(addressFrom, addressTo, humanValue);
    console.log(`Quoted Amount Out: ${result}`);

    const fromTokenData = await fetchTokenData(addressFrom);
    const toTokenData = await fetchTokenData(addressTo);

    console.log(`From Token - Name: ${fromTokenData.name}, Symbol: ${fromTokenData.symbol}, Decimals: ${fromTokenData.decimals}`);
    console.log(`To Token - Name: ${toTokenData.name}, Symbol: ${toTokenData.symbol}, Decimals: ${toTokenData.decimals}`);
};

main().catch(console.error);
