import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { anvil } from "wagmi/chains";

export const config = createConfig({
  chains: [anvil],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(),
  },
});

// Update these after deploying the contracts
export const TOKEN_BANK_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const MY_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
