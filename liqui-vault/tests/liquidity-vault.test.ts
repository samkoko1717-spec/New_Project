import { describe, it, expect } from 'vitest';
import { Cl, cvToJSON } from '@stacks/transactions';
import { tx } from '@hirosystems/clarinet-sdk';

const CONTRACT = 'liquidity-vault';
const simnet: any = (globalThis as any).simnet;

function okUint(result: any): bigint {
  const j = cvToJSON(result);
  // ResponseOk -> success === true
  if (j.success && j.value?.type === 'uint') {
    return BigInt(j.value.value);
  }
  throw new Error('Not an ok uint');
}

function expectErrCode(result: any, code: bigint) {
  const j = cvToJSON(result);
  if (!(!j.success && j.value?.type === 'uint' && BigInt(j.value.value) === code)) {
    throw new Error(`Expected err u${code}, got ${JSON.stringify(j)}`);
  }
}

describe('Liquidity Vault', () => {
  it('deposit mints shares; rejects zero and too-small lock', () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get('deployer');
    const w1 = accounts.get('wallet_1');

    // zero amount -> err u101
    let r = simnet.mineBlock([tx.callPublicFn(CONTRACT, 'deposit', [Cl.uint(0), Cl.uint(100)], w1)])[0];
    expectErrCode(r.result, 101n);

    // too small lock -> err u103
    r = simnet.mineBlock([tx.callPublicFn(CONTRACT, 'deposit', [Cl.uint(1000), Cl.uint(50)], w1)])[0];
    expectErrCode(r.result, 103n);

    // valid deposit
    r = simnet.mineBlock([tx.callPublicFn(CONTRACT, 'deposit', [Cl.uint(1_000_000), Cl.uint(200)], w1)])[0];

    // Verify user shares via read-only
    const ro = simnet.callReadOnlyFn(CONTRACT, 'get-user', [Cl.principal(w1)], deployer);
    const j = cvToJSON(ro.result);
    const tup = (j.value as any).data ?? (j.value as any).value;
    const shares = BigInt(tup.shares.value);
    expect(shares).toBe(1_000_000n);
  });

  it('early withdraw has penalty; unlocked path has none (via lowering min-lock)', () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get('deployer');
    const w1 = accounts.get('wallet_1');
    const w2 = accounts.get('wallet_2');

    // deposit with lock (w1)
    simnet.mineBlock([tx.callPublicFn(CONTRACT, 'deposit', [Cl.uint(1_000_000), Cl.uint(100)], w1)]);

    // early withdraw 200_000 => penalty 10_000, paid 190_000
    const w = simnet.mineBlock([tx.callPublicFn(CONTRACT, 'withdraw', [Cl.uint(200_000)], w1)])[0];
    const wj = cvToJSON(w.result);
    const tup = (wj.value as any).data ?? (wj.value as any).value;
    expect(BigInt(tup.penalty.value)).toBe(10_000n);
    expect(BigInt(tup.paid.value)).toBe(190_000n);

    // lower min-lock to 0 (admin)
    simnet.mineBlock([tx.callPublicFn(CONTRACT, 'set-min-lock-blocks', [Cl.uint(0)], deployer)]);

    // new user (w2) deposit with zero lock, then withdraw immediately with no penalty
    simnet.mineBlock([tx.callPublicFn(CONTRACT, 'deposit', [Cl.uint(100_000), Cl.uint(0)], w2)]);
    const w2res = simnet.mineBlock([tx.callPublicFn(CONTRACT, 'withdraw', [Cl.uint(100_000)], w2)])[0];
    const w2j = cvToJSON(w2res.result);
    const tup2 = (w2j.value as any).data ?? (w2j.value as any).value;
    expect(BigInt(tup2.penalty.value)).toBe(0n);
    expect(BigInt(tup2.paid.value)).toBe(100_000n);
  });

  it('admin distributes yield; user claims it', () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get('deployer');
    const w1 = accounts.get('wallet_1');

    // fresh deposit
    simnet.mineBlock([tx.callPublicFn(CONTRACT, 'deposit', [Cl.uint(1_000_000), Cl.uint(100)], w1)]);

    // owed before
    const before = cvToJSON(simnet.callReadOnlyFn(CONTRACT, 'get-user', [Cl.principal(w1)], deployer).result);
    const beforeT = (before.value as any).data ?? (before.value as any).value;
    const owedBefore = BigInt(beforeT.owed.value);

    // distribute
    simnet.mineBlock([tx.callPublicFn(CONTRACT, 'distribute-yield', [Cl.uint(100_000)], deployer)]);

    // claim should pay 100_000
    const claim = simnet.mineBlock([tx.callPublicFn(CONTRACT, 'claim-yield', [], w1)])[0];
    expect(okUint(claim.result)).toBe(100_000n);

    // owed becomes 0
    const after = cvToJSON(simnet.callReadOnlyFn(CONTRACT, 'get-user', [Cl.principal(w1)], deployer).result);
    const afterT = (after.value as any).data ?? (after.value as any).value;
    expect(BigInt(afterT.owed.value)).toBe(0n);
  });
});
