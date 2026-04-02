/**
 * Formats a number with subscript for leading zeros if there are 4 or more zeros after the decimal.
 * Example: 0.000000144 -> 0.0₆144
 */
export function formatCompactDecimal(value: number | string, maxDecimals = 10): string | JSX.Element {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "0";
  if (num >= 0.0001) return num.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });

  const str = num.toFixed(maxDecimals + 5); // Get enough precision
  const match = str.match(/^0\.(0{4,})(\d+)/);

  if (match) {
    const zeros = match[1].length;
    const significant = match[2].slice(0, 4); // Show up to 4 significant digits
    const subscript = (zeros: number) => {
        const subs = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
        return Array.from(zeros.toString()).map(d => subs[parseInt(d)]).join("");
    };

    return (
      <span className="inline-flex items-center">
        0.0<sub className="text-[0.6em] leading-none translate-y-[0.1em]">{zeros}</sub>{significant}
      </span>
    );
  }

  return num.toFixed(Math.min(maxDecimals, 8));
}
