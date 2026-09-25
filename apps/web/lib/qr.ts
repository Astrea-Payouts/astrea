import QRCode from 'qrcode';

/**
 * Generates an SVG path and size for a QR code representing the given URL.
 *
 * @param url - The URL to encode in the QR code.
 * @returns An object containing the SVG path data (`path`) and the size of the QR code (`size`).
 */
export async function qrSvgPath(url: string): Promise<{ path: string; size: number }> {
  // Generate a full SVG string with no margin and a default width of 200px.
  const svgString = await QRCode.toString(url, { type: 'svg', margin: 0, width: 200 });

  // Extract the viewBox to determine the size of the QR code.
  const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);
  const size = viewBoxMatch
    ? Math.max(
        ...viewBoxMatch[1]
          .split(' ')
          .slice(2, 4)
          .map((v) => parseInt(v, 10))
      )
    : 200;

  // Extract the path data from the SVG string.
  const pathMatch = svgString.match(/<path d="([^"]+)"/);
  const path = pathMatch ? pathMatch[1] : '';

  return { path, size };
}
