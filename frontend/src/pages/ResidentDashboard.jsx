import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Navbar from '../components/Navbar.jsx';
import ParcelCard from '../components/ParcelCard.jsx';
import api from '../lib/api.js';

export default function ResidentDashboard() {
  const qc = useQueryClient();
  const [linkCode, setLinkCode] = useState(null);
  const [telegramLinked, setTelegramLinked] = useState(false);

  const { data: parcels = [], isLoading } = useQuery({
    queryKey: ['my-parcels'],
    queryFn: () => api.get('/parcels').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    onSuccess: (data) => setTelegramLinked(!!data.telegramChatId),
  });

  const collectMutation = useMutation({
    mutationFn: (id) => api.patch(`/parcels/${id}/collect`),
    onSuccess: () => qc.invalidateQueries(['my-parcels']),
  });

  const getLinkCode = async () => {
    const { data } = await api.get('/users/link-code');
    setLinkCode(data.linkCode);
  };

  const pending = parcels.filter((p) => p.status === 'PENDING');
  const collected = parcels.filter((p) => p.status === 'COLLECTED');
  const expired = parcels.filter((p) => p.status === 'EXPIRED');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Telegram linking */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-2">Telegram Notifications</h2>
          {me?.telegramChatId ? (
            <p className="text-green-600 text-sm">Telegram linked! You'll receive DMs for parcel updates.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Link your Telegram account to receive instant DMs when your parcel arrives.
              </p>
              <button
                onClick={getLinkCode}
                className="bg-indigo-600 text-white text-sm px-4 py-2 rounded hover:bg-indigo-700"
              >
                Get Link Code
              </button>
              {linkCode && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                  <p className="font-medium text-gray-700 mb-1">Your link code:</p>
                  <code className="text-lg font-mono text-indigo-700">{linkCode}</code>
                  <p className="text-gray-500 mt-2">
                    Open Telegram, start a chat with our bot, and send:<br />
                    <code className="bg-gray-200 px-1 rounded">/link {linkCode}</code>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pending parcels */}
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">
            Pending Parcels{' '}
            <span className="text-sm font-normal text-gray-500">({pending.length})</span>
          </h2>
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-gray-400 text-sm">No pending parcels.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <ParcelCard
                  key={p.id}
                  parcel={p}
                  onCollect={(id) => collectMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Collected */}
        {collected.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-800 mb-3">
              Collected <span className="text-sm font-normal text-gray-500">({collected.length})</span>
            </h2>
            <div className="space-y-3">
              {collected.map((p) => <ParcelCard key={p.id} parcel={p} />)}
            </div>
          </section>
        )}

        {/* Expired */}
        {expired.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-800 mb-3">
              Expired <span className="text-sm font-normal text-gray-500">({expired.length})</span>
            </h2>
            <div className="space-y-3">
              {expired.map((p) => <ParcelCard key={p.id} parcel={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
