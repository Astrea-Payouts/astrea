'use server';
import { qrSvgPath } from '@/lib/qr';

/**
 * Server component that renders a QR code as an inline SVG.
 *
 * @param url - The URL to encode in the QR code.
 */
export default async function QRCode({ url }: { url: string }) {
  const { path, size } = await qrSvgPath(url);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="border border-gray-200 rounded-md"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
