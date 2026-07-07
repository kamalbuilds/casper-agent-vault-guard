export function truncateMiddle(value: string, front = 8, back = 6): string {
  if (value.length <= front + back + 3) {
    return value;
  }
  return `${value.slice(0, front)}...${value.slice(-back)}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://testnet.cspr.live/deploy/${hash}`;
}
