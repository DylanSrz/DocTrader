import 'server-only';
import QRCode from 'qrcode';

/**
 * Código QR de un texto (la dirección de depósito), dibujado en el servidor como un solo trazo SVG. Lleva solo la
 * dirección, sin `bitcoin:` ni monto: así lo leen todas las billeteras y el cliente escribe el monto exacto. Fondo
 * blanco con margen: los lectores no leen bien un QR claro sobre fondo oscuro.
 */
export function CodigoQr({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const margen = 4;
  const lado = modules.size + margen * 2;
  let trazo = '';
  for (let fila = 0; fila < modules.size; fila++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(fila, col)) trazo += `M${col + margen} ${fila + margen}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="size-40 shrink-0 rounded-xl bg-blanco"
    >
      <path d={trazo} fill="#000" />
    </svg>
  );
}
