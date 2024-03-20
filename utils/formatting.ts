import * as anchor from '@coral-xyz/anchor';

export function parseUnits(_num: anchor.BN | number) {
  return typeof _num === 'number'
    ? new anchor.BN((_num * 1e9).toString())
    : _num.mul(new anchor.BN(1e9));
}

export function formatUnits(_num: anchor.BN | number) {
  return typeof _num === 'number' ? _num / 1e9 : _num.toNumber() / 1e9;
}

export function eToNumber(num: any): string {
  let sign = '';
  (num += '').charAt(0) == '-' && ((num = num.substring(1)), (sign = '-'));
  let arr = num.split(/[e]/gi);
  if (arr.length < 2) return sign + num;
  let dot = (0.1).toLocaleString().substr(1, 1),
    n = arr[0],
    exp = +arr[1],
    w = (n = n.replace(/^0+/, '')).replace(dot, ''),
    pos = n.split(dot)[1] ? n.indexOf(dot) + exp : w.length + exp,
    L = pos - w.length,
    s = '' + BigInt(w);
  w =
    exp >= 0
      ? L >= 0
        ? s + '0'.repeat(L)
        : r()
      : pos <= 0
      ? '0' + dot + '0'.repeat(Math.abs(pos)) + s
      : r();
  L = w.split(dot);
  if ((L[0] == 0 && L[1] == 0) || (+w == 0 && +s == 0)) w = 0; //** added 9/10/2021
  return sign + w;
  function r() {
    return w.replace(new RegExp(`^(.{${pos}})(.)`), `$1${dot}$2`);
  }
}

export function limitPrecision(value: number, decimals: number) {
  if (value.toString().includes('.')) {
    const splitedValue = eToNumber(value).split('.');
    let afterPointValue = splitedValue[1].slice(0, decimals);
    afterPointValue =
      afterPointValue.length < decimals
        ? `${afterPointValue}${'0'.repeat(decimals - afterPointValue.length)}`
        : afterPointValue;
    return `${splitedValue[0]}.${afterPointValue}`;
  }
  return value.toString();
}
