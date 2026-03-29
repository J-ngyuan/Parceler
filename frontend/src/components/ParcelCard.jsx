import { useState } from 'react';
import { format } from 'date-fns';
import CountdownTimer from './CountdownTimer.jsx';

export default function ParcelCard({ parcel, onScanQR, onRequestExtension, showResident = false }) {
  const [showPhoto, setShowPhoto] = useState(false);

  const latestExtension = parcel.extensionRequests?.[0];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900 text-sm">#{parcel.trackingNumber}</p>
          {showResident && (
            <p className="text-sm text-gray-600">{parcel.resident?.name} &lt;{parcel.resident?.email}&gt;</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Delivered: {format(new Date(parcel.deliveredAt), 'dd MMM yyyy, HH:mm')}
          </p>
          {parcel.collectedAt && (
            <p className="text-xs text-gray-500">
              Collected: {format(new Date(parcel.collectedAt), 'dd MMM yyyy, HH:mm')}
            </p>
          )}
          {parcel.photoUrl && (
            <button
              onClick={() => setShowPhoto(!showPhoto)}
              className="text-xs text-indigo-600 hover:underline mt-1"
            >
              {showPhoto ? 'Hide photo' : 'View photo'}
            </button>
          )}
          {latestExtension && parcel.status === 'PENDING' && (
            <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block font-medium ${
              latestExtension.status === 'PENDING'
                ? 'bg-yellow-100 text-yellow-700'
                : latestExtension.status === 'APPROVED'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              Extension: {latestExtension.status === 'PENDING' ? 'Awaiting approval' : latestExtension.status === 'APPROVED' ? `Approved (+${latestExtension.requestedDays}d)` : 'Rejected'}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 space-y-2">
          <CountdownTimer expiresAt={parcel.expiresAt} status={parcel.status} />
          {parcel.status === 'PENDING' && onScanQR && (
            <button
              onClick={() => onScanQR(parcel.id)}
              className="block text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 w-full"
            >
              Scan QR to Collect
            </button>
          )}
          {parcel.status === 'PENDING' && onRequestExtension && !latestExtension?.status.match(/^(PENDING)$/) && (
            <button
              onClick={() => onRequestExtension(parcel)}
              className="block text-xs bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 w-full"
            >
              Request Extension
            </button>
          )}
        </div>
      </div>
      {showPhoto && parcel.photoUrl && (
        <img
          src={parcel.photoUrl}
          alt="Parcel photo"
          className="mt-3 w-full max-h-56 object-cover rounded border border-gray-200"
        />
      )}
    </div>
  );
}
