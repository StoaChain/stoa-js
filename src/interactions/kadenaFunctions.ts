import { pactRead } from "../reads";

export interface BalanceItem {
  account: string;
  balance: string;
}

export async function getBalance(account: string): Promise<BalanceItem> {
  const pactCode = `(coin.get-balance "${account}")`;
  const response = await pactRead(pactCode, { tier: "T1" });

  const raw = (response.result as any).data;
  // Kadena may return { decimal: "..." } — unwrap to plain string
  const balance = raw && typeof raw === "object" && "decimal" in raw
    ? String(raw.decimal)
    : String(raw ?? "0");

  return { account, balance };
}

export async function accountDescription(address: string) {
  const pactCode = `(coin.details "${address}")`;
  const { result }: any = await pactRead(pactCode, { tier: "T5" });

  return {
    isNewAccount: result?.status === "failure",
    balance: result?.data?.balance || "0",
    account: result?.data?.account || address,
    guard: result?.data?.guard || null,
  };
}
