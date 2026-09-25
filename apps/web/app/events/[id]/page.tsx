import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from '@/components/QRCode';
import { getEventById } from '@/lib/events'; // Adjust import path as needed

export default async function EventPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await getEventById(params.id);

  if (!event) {
    return notFound();
  }

  // Build the full public URL for the event page.
  const protocol = headers().get('x-forwarded-proto') ?? 'https';
  const host = headers().get('host') ?? '';
  const baseUrl = `${protocol}://${host}`;
  const fullUrl = `${baseUrl}/events/${params.id}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{event.title}</h1>
      {/* Existing event details go here */}
      <div className="mb-8">
        {/* ... other event information ... */}
      </div>

      {/* QR Code for sharing */}
      <div className="mt-8 flex justify-center">
        <QRCode url={fullUrl} />
      </div>
    </div>
  );
}
