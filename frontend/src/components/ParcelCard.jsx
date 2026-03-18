import { useState } from 'react';
import { format } from 'date-fns';
import CountdownTimer from './CountdownTimer.jsx';

export default function ParcelCard({ parcel, onCollect, showResident = false }) {
  const [showPhoto, setShowPhoto] = useState(false);

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
        </div>
        <div className="text-right shrink-0">
          <CountdownTimer expiresAt={parcel.expiresAt} status={parcel.status} />
          {parcel.status === 'PENDING' && onCollect && (
            <button
              onClick={() => onCollect(parcel.id)}
              className="mt-2 block text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
            >
              Mark Collected
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
