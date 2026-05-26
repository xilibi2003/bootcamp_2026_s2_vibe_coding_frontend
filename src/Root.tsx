import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { wagmiAdapter, projectId, networks } from "./config";
import App from "./App";

const queryClient = new QueryClient();

const metadata = {
  name: "TokenBank",
  description: "TokenBank DApp - Deposit & Withdraw Tokens",
  url: window.location.origin,
  icons: [],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: networks as [any, ...any[]],
  defaultNetwork: networks[0],
  metadata,
});

export default function Root() {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
