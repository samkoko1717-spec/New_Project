import React, { useMemo, useState } from 'react';
import { AppConfig, UserSession, showConnect, openContractCall, FinishedTxData } from '@stacks/connect';
import { uintCV } from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3>{props.title}</h3>
      {props.children}
    </div>
  );
}

export default function App() {
  const [contract, setContract] = useState('');
  const [deposit, setDeposit] = useState('1000000');
  const [lock, setLock] = useState('100');
  const [withdraw, setWithdraw] = useState('250000');
  const [status, setStatus] = useState('');
  const isSignedIn = userSession.isUserSignedIn();
  const network = useMemo(() => new StacksTestnet(), []);

  const connect = () => showConnect({ userSession, appDetails: { name: 'Liquidity Vault v2', icon: '' }, onFinish: () => window.location.reload() });

  const call = async (fn: string, args: any[]) => {
    if (!isSignedIn) return connect();
    const [address, name] = contract.split('.');
    if (!address || !name) return setStatus('Enter contract as SP...ABC.liquidity-vault');
    await openContractCall({ contractAddress: address, contractName: name, functionName: fn, functionArgs: args, network,
      appDetails: { name: 'Liquidity Vault v2', icon: '' },
      onFinish: (d: FinishedTxData) => setStatus(`Tx: ${d.txId}`), onCancel: () => setStatus('Canceled')
    } as any);
  };

  return (
    <div className="container">
      <h1>Liquidity Vault v2</h1>
      <div className="grid">
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <button onClick={connect}>{isSignedIn ? 'Reconnect' : 'Connect Wallet'}</button>
            <input placeholder="SP...Deployer.liquidity-vault" value={contract} onChange={(e) => setContract(e.target.value)} style={{ flex: 1 }} />
          </div>
          <p>Commit liquidity with a time lock. Early withdrawals are penalized and feed the shared pool. Yield is distributed per-share.</p>
        </div>

        <Card title="Deposit">
          <div className="row"><input value={deposit} onChange={(e) => setDeposit(e.target.value)} /><input value={lock} onChange={(e) => setLock(e.target.value)} /></div>
          <div style={{ height: 6, background: '#1f2a44', borderRadius: 6, margin: '8px 0' }}>
            <div style={{ width: `${Math.min(100, Number(lock) / 2)}%`, background: '#3b82f6', height: 6, borderRadius: 6 }}></div>
          </div>
<button onClick={() => call('deposit', [uintCV(BigInt(deposit)), uintCV(BigInt(lock))])}>Deposit STX</button>
        </Card>

        <Card title="Withdraw">
          <div className="row"><input value={withdraw} onChange={(e) => setWithdraw(e.target.value)} /></div>
<button onClick={() => call('withdraw', [uintCV(BigInt(withdraw))])}>Withdraw</button>
        </Card>

        <Card title="Claim Yield">
          <button onClick={() => call('claim-yield', [])}>Claim</button>
        </Card>

        <Card title="Admin: Distribute Yield">
<button onClick={() => call('distribute-yield', [uintCV(100000)])}>Distribute 100k STX</button>
        </Card>
      </div>
      <p style={{ opacity: 0.8 }}>{status}</p>
    </div>
  );
}