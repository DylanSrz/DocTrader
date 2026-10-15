import Image from 'next/image';
import Link from 'next/link';
import logo from '../../public/marca/logo-icon.png';

/** Logo y nombre de la marca, enlazados al inicio. */
export function Marca() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-3 text-blanco no-underline">
      <Image src={logo} alt="" width={27} priority />
      <span className="text-base font-semibold tracking-[-0.02em] sm:text-lg" translate="no">
        DocTraderPRO
      </span>
    </Link>
  );
}
