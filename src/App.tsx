import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { TOKEN_BANK_ADDRESS, MY_TOKEN_ADDRESS } from "./config";
import tokenBankAbi from "./contracts/TokenBank.abi.json";
import myTokenAbi from "./contracts/MyToken.abi.json";
import "./App.css";

function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [amount, setAmount] = useState("");

  // Read token info
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

  // Read user's token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: MY_TOKEN_ADDRESS,
    abi: myTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read user's deposited amount in TokenBank
  const {
    data: deposited,
    refetch: refetchDeposited,
  } = useReadContract({
    address: TOKEN_BANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: "depositedAmount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read admin
  const { data: admin } = useReadContract({
    address: TOKEN_BANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: "admin",
  });

  const isAdmin = address && admin && address.toLowerCase() === (admin as string).toLowerCase();

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
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="btn btn-connect"
            >
              Connect Wallet
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="wallet-bar">
            <span className="address">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            {isAdmin && <span className="badge">Admin</span>}
            <button onClick={() => disconnect()} className="btn btn-disconnect">
              Disconnect
            </button>
          </div>

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
        </>
      )}
    </div>
  );
}

export default App;
