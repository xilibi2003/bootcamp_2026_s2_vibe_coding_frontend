import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignMessage,
} from "wagmi";
import { useAppKit, useDisconnect } from "@reown/appkit/react";
import { useState, useEffect, useCallback } from "react";
import { formatUnits, parseUnits } from "viem";
import { TOKEN_BANK_ADDRESS, MY_TOKEN_ADDRESS } from "./config";
import tokenBankAbi from "./contracts/TokenBank.abi.json";
import myTokenAbi from "./contracts/MyToken.abi.json";
import "./App.css";

function App() {
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [amount, setAmount] = useState("");

  // SIWE Authentication States
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem("authToken"));
  const [authAddress, setAuthAddress] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [siweError, setSiweError] = useState<string | null>(null);

  // Transfers History States
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isTransfersLoading, setIsTransfersLoading] = useState(false);

  const { data: symbol } = useReadContract({
    address: MY_TOKEN_ADDRESS,
    abi: myTokenAbi,
    functionName: "symbol",
  });

  const { data: decimals } = useReadContract({
    address: MY_TOKEN_ADDRESS,
    abi: myTokenAbi,
    functionName: "decimals",
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MY_TOKEN_ADDRESS,
    abi: myTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: deposited, refetch: refetchDeposited } = useReadContract({
    address: TOKEN_BANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: "depositedAmount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: admin } = useReadContract({
    address: TOKEN_BANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: "admin",
  });

  const isAdmin = !!(
    address && admin && address.toLowerCase() === (admin as string).toLowerCase()
  );

  // Approve
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Deposit
  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositPending,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({ hash: depositHash });

  // Withdraw
  const {
    writeContract: withdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
  } = useWriteContract();

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  const tokenDecimals = (decimals as number) ?? 18;

  // Check auth session
  const checkAuth = useCallback(async (token: string, currentAddress: string) => {
    setIsAuthLoading(true);
    try {
      const res = await fetch("/api/siwe/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.address.toLowerCase() === currentAddress.toLowerCase()) {
          setAuthAddress(data.address);
          setAuthToken(token);
          return;
        }
      }
      // If invalid, clear it
      localStorage.removeItem("authToken");
      setAuthToken(null);
      setAuthAddress(null);
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected && address && authToken) {
      checkAuth(authToken, address);
    } else {
      setAuthAddress(null);
    }
  }, [isConnected, address, authToken, checkAuth]);

  // Fetch Transfers
  const fetchTransfers = useCallback(async () => {
    if (!authToken || !authAddress) return;
    setIsTransfersLoading(true);
    try {
      const res = await fetch("/api/transfers", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data);
      }
    } catch (err) {
      console.error("Failed to fetch transfers", err);
    } finally {
      setIsTransfersLoading(false);
    }
  }, [authToken, authAddress]);

  useEffect(() => {
    if (authAddress && address && authAddress.toLowerCase() === address.toLowerCase()) {
      fetchTransfers();
    } else {
      setTransfers([]);
    }
  }, [authAddress, address, fetchTransfers]);

  // Refetch balances and transfers when transaction succeeds
  useEffect(() => {
    if (isDepositSuccess || isWithdrawSuccess || isApproveSuccess) {
      refetchBalance();
      refetchDeposited();
      fetchTransfers();
    }
  }, [isDepositSuccess, isWithdrawSuccess, isApproveSuccess, refetchBalance, refetchDeposited, fetchTransfers]);

  // Sign In Flow
  const handleSignIn = async () => {
    if (!address) return;
    setSiweError(null);
    setIsAuthLoading(true);
    try {
      // 1. Fetch nonce
      const nonceRes = await fetch("/api/siwe/nonce");
      if (!nonceRes.ok) throw new Error("Failed to get sign-in nonce");
      const { nonce } = await nonceRes.json();

      // 2. Format SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = "Sign in with Ethereum to the TokenBank DApp.";
      
      const message = `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${origin}
Version: 1
Chain ID: ${chainId ?? 31337}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;

      // 3. Sign message
      const signature = await signMessageAsync({ message });

      // 4. Verify signature on the backend
      const verifyRes = await fetch("/api/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        throw new Error(errData.error || "Failed to verify signature");
      }

      const { token } = await verifyRes.json();
      localStorage.setItem("authToken", token);
      setAuthToken(token);
      setAuthAddress(address);
    } catch (err: any) {
      console.error("SIWE error:", err);
      setSiweError(err.message || "Failed to sign in with Ethereum.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("authToken");
    setAuthToken(null);
    setAuthAddress(null);
    setTransfers([]);
    disconnect();
  };

  const handleApprove = () => {
    if (!amount) return;
    approve({
      address: MY_TOKEN_ADDRESS,
      abi: myTokenAbi,
      functionName: "approve",
      args: [TOKEN_BANK_ADDRESS, parseUnits(amount, tokenDecimals)],
    });
  };

  const handleDeposit = () => {
    if (!amount) return;
    deposit({
      address: TOKEN_BANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: "deposit",
      args: [parseUnits(amount, tokenDecimals)],
    });
  };

  const handleWithdraw = () => {
    withdraw({
      address: TOKEN_BANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: "withdraw",
    });
  };

  const formatBalance = (value: unknown) => {
    if (value == null) return "0";
    return formatUnits(BigInt(value as string), tokenDecimals);
  };

  return (
    <div className="app">
      <h1>TokenBank</h1>

      {!isConnected ? (
        <div className="connect-section">
          <button onClick={() => open()} className="btn btn-connect">
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          <div className="wallet-bar">
            <span className="address">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            {isAdmin && <span className="badge">Admin</span>}
            <button onClick={handleSignOut} className="btn btn-disconnect">
              Disconnect
            </button>
          </div>

          {!authAddress ? (
            <div className="siwe-card">
              <h2>Sign In Required</h2>
              <p className="siwe-description">
                To interact with TokenBank and view your transfer history, you need to sign in with your Ethereum account.
              </p>
              <button
                onClick={handleSignIn}
                disabled={isAuthLoading}
                className="btn btn-siwe"
              >
                {isAuthLoading ? "Signing in..." : "Sign In with Ethereum"}
              </button>
              {siweError && (
                <p className="hint" style={{ color: "#e74c3c", marginTop: "12px", fontWeight: 500 }}>
                  {siweError}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="card">
                <h2>Your Balance</h2>
                <p className="balance">
                  {formatBalance(balance)} {symbol as string}
                </p>
              </div>

              <div className="card">
                <h2>Deposited</h2>
                <p className="balance">
                  {formatBalance(deposited)} {symbol as string}
                </p>
              </div>

              <div className="card">
                <h2>Deposit Tokens</h2>
                <div className="form-row">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input"
                    min="0"
                    step="any"
                  />
                </div>
                <div className="btn-row">
                  <button
                    onClick={handleApprove}
                    disabled={!amount || isApprovePending || isApproveConfirming}
                    className="btn btn-primary"
                  >
                    {isApprovePending
                      ? "Approve in wallet..."
                      : isApproveConfirming
                        ? "Approving..."
                        : "Approve"}
                  </button>
                  <button
                    onClick={handleDeposit}
                    disabled={
                      !amount || !isApproveSuccess || isDepositPending || isDepositConfirming
                    }
                    className="btn btn-primary"
                  >
                    {isDepositPending
                      ? "Deposit in wallet..."
                      : isDepositConfirming
                        ? "Depositing..."
                        : "Deposit"}
                  </button>
                </div>
                {isApproveSuccess && (
                  <p className="hint success">Approved! You can now deposit.</p>
                )}
              </div>

              {isAdmin && (
                <div className="card">
                  <h2>Admin: Withdraw</h2>
                  <p className="hint">
                    Withdraw all tokens from the bank to your address.
                  </p>
                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawPending || isWithdrawConfirming}
                    className="btn btn-danger"
                  >
                    {isWithdrawPending
                      ? "Confirm in wallet..."
                      : isWithdrawConfirming
                        ? "Withdrawing..."
                        : "Withdraw All Tokens"}
                  </button>
                </div>
              )}

              {/* Transfer History Section */}
              <div className="history-card">
                <div className="history-header">
                  <h2>Transfer History</h2>
                  <button
                    onClick={fetchTransfers}
                    disabled={isTransfersLoading}
                    className="btn-refresh"
                  >
                    {isTransfersLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {isTransfersLoading && transfers.length === 0 ? (
                  <div className="empty-history">Loading transfer records...</div>
                ) : transfers.length === 0 ? (
                  <div className="empty-history">No transfer records found.</div>
                ) : (
                  <div className="history-list">
                    {transfers.map((tx) => {
                      const isOutgoing = tx.from_address.toLowerCase() === address?.toLowerCase();
                      const otherAddr = isOutgoing ? tx.to_address : tx.from_address;

                      let directionLabel = isOutgoing ? "Out" : "In";
                      let otherLabel = otherAddr;

                      if (otherAddr === "0x0000000000000000000000000000000000000000") {
                        directionLabel = isOutgoing ? "Burn" : "Mint";
                        otherLabel = isOutgoing ? "Burn Address" : "Genesis Mint";
                      } else if (otherAddr.toLowerCase() === TOKEN_BANK_ADDRESS.toLowerCase()) {
                        directionLabel = isOutgoing ? "Deposit" : "Withdraw";
                        otherLabel = "TokenBank Contract";
                      } else {
                        otherLabel = `${otherAddr.slice(0, 6)}...${otherAddr.slice(-4)}`;
                      }

                      const formattedAmount = formatUnits(BigInt(tx.value), tokenDecimals);
                      const txDate = new Date(tx.timestamp * 1000).toLocaleString();

                      return (
                        <div key={tx.id} className="history-item">
                          <div className="history-item-left">
                            <div className="history-direction">
                              <span className={`history-badge ${isOutgoing ? "outgoing" : "incoming"}`}>
                                {directionLabel}
                              </span>
                              <span className="history-address" title={otherAddr}>
                                {otherLabel}
                              </span>
                            </div>
                            <div className="history-meta">
                              <a
                                href={`https://etherscan.io/tx/${tx.transaction_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="history-hash-link"
                              >
                                {tx.transaction_hash.slice(0, 8)}...{tx.transaction_hash.slice(-6)}
                              </a>
                              <span>•</span>
                              <span>Block #{tx.block_number}</span>
                              <span>•</span>
                              <span>{txDate}</span>
                            </div>
                          </div>
                          <div className="history-item-right">
                            <span className={`history-amount ${isOutgoing ? "outgoing" : "incoming"}`}>
                              {isOutgoing ? "-" : "+"}{formattedAmount}
                            </span>
                            <span style={{ fontSize: "11px", color: "#666" }}>{symbol as string}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
