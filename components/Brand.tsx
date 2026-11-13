import Link from "next/link";
export function Brand() {
  return <Link href="/" className="brand" aria-label="TaskFlow home"><span className="brand-mark" aria-hidden="true">✓</span>TaskFlow<span className="brand-dot">.</span></Link>;
}
