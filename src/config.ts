import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { anvil } from "wagmi/chains";
import { http } from "wagmi";

// Get a projectId from https://cloud.reown.com
export const projectId = "95e25ba0eac827fb18d92ddd44e6fa67";

export const networks = [anvil];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  transports: {
    [anvil.id]: http(),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Update these after deploying the contracts
export const TOKEN_BANK_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const MY_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
