import React, { useMemo, useState } from 'react';
import { AppConfig, UserSession, showConnect, openContractCall, FinishedTxData } from '@stacks/connect';
import { uintCV } from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export default function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [depositAmount, setDepositAmount] = useState('1000000');
  const [lockBlocks, setLockBlocks] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('500000');
  const [status, setStatus] = useState<string>('');

  const isSignedIn = userSession.isUserSignedIn();
  const network = useMemo(() => new StacksTestnet(), []);

  const connectWallet = () => {
    showConnect({
      userSession,
      appDetails: { name: 'Liquidity Vault v1', icon: window.location.origin + '/icon.png' },
      onFinish: () => window.location.reload(),
    });
  };

  const call = async (functionName: string, args: any[]) => {
    if (!isSignedIn) return connectWallet();
    const [address, name] = contractAddress.split('.');
    if (!address || !name) return setStatus('Enter contract as SP...ABC.liquidity-vault');

    const txOptions = {
      contractAddress: address,
      contractName: name,
      functionName,
      functionArgs: args,
      network,
      appDetails: { name: 'Liquidity Vault v1', icon: window.location.origin + '/icon.png' },
      onFinish: (data: FinishedTxData) => setStatus(`Submitted: ${data.txId}`),
      onCancel: () => setStatus('User canceled'),
    } as const;

    await openContractCall(txOptions as any);
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Liquidity Vault v1</h1>
      <p>Connect and interact with the Commitment Liquidity Vault on testnet/devnet.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={connectWallet}>{isSignedIn ? 'Reconnect' : 'Connect Wallet'}</button>
        <input
          placeholder="SP...Deployer.liquidity-vault"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      <h2 style={{ marginTop: 24 }}>Deposit</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
        <input value={lockBlocks} onChange={(e) => setLockBlocks(e.target.value)} />
        <button
          onClick={() =>
call('deposit', [
              uintCV(BigInt(depositAmount)),
              uintCV(BigInt(lockBlocks)),
            ])
          }
        >
          Deposit STX
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>Withdraw</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
<button onClick={() => call('withdraw', [uintCV(BigInt(withdrawAmount))])}>
          Withdraw
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>Claim Yield</h2>
      <button onClick={() => call('claim-yield', [])}>Claim</button>

      <h2 style={{ marginTop: 24 }}>Admin</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() =>
call('distribute-yield', [uintCV(100000)])
          }
        >
          Distribute 100k STX
        </button>
      </div>

      <p style={{ marginTop: 16, color: '#555' }}>{status}</p>
    </div>
  );
}