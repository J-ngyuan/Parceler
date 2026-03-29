import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Navbar from '../components/Navbar.jsx';
import ParcelCard from '../components/ParcelCard.jsx';
import api from '../lib/api.js';

function QRScannerModal({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scanner.render(
      (decodedText) => {
        scanner.clear().then(() => onScan(decodedText)).catch(() => onScan(decodedText));
      },
      () => {}
    );
    return () => { scanner.clear().catch(() => {}); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-800 mb-1">Scan QR to Collect</h3>
        <p className="text-sm text-gray-500 mb-4">Point your camera at the QR code on your parcel</p>
        <div id="qr-reader" />
        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-gray-500 py-2 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ResidentDashboard() {
  const qc = useQueryClient();
  const [linkCode, setLinkCode] = useState(null);

  // QR scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState(null); // 'success' | 'error' | null
  const [scanMessage, setScanMessage] = useState('');

  // Extension request state
  const [extensionModal, setExtensionModal] = useState(null); // parcel object or null
  const [extensionForm, setExtensionForm] = useState({ reason: '', days: '' });
  const [extensionError, setExtensionError] = useState('');
  const [extensionSuccess, setExtensionSuccess] = useState(false);

  const { data: parcels = [], isLoading } = useQuery({
    queryKey: ['my-parcels'],
    queryFn: () => api.get('/parcels').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  });

  const collectQRMutation = useMutation({
    mutationFn: (token) => api.post(`/parcels/collect-qr/${token}`),
    onSuccess: () => {
      qc.invalidateQueries(['my-parcels']);
      setScanStatus('success');
      setScanMessage('Parcel marked as collected!');
      setTimeout(() => setScanStatus(null), 3000);
    },
    onError: (err) => {
      setScanStatus('error');
      setScanMessage(err.response?.data?.error || 'Invalid QR code. Please try again.');
      setTimeout(() => setScanStatus(null), 4000);
    },
  });

  const extensionMutation = useMutation({
    mutationFn: ({ parcelId, reason, requestedDays }) =>
      api.post(`/parcels/${parcelId}/extension-request`, { reason, requestedDays }),
    onSuccess: () => {
      qc.invalidateQueries(['my-parcels']);
      setExtensionModal(null);
      setExtensionForm({ reason: '', days: '' });
      setExtensionSuccess(true);
      setTimeout(() => setExtensionSuccess(false), 3000);
    },
    onError: (err) => {
      setExtensionError(err.response?.data?.error || 'Failed to submit request');
    },
  });

  const getLinkCode = async () => {
    const { data } = await api.get('/users/link-code');
    setLinkCode(data.linkCode);
  };

  const handleScan = (token) => {
    setScannerOpen(false);
    collectQRMutation.mutate(token);
  };

  const handleExtensionSubmit = (e) => {
    e.preventDefault();
    setExtensionError('');
    const days = parseInt(extensionForm.days, 10);
    if (!extensionForm.reason.trim()) return setExtensionError('Please provide a reason.');
    if (!days || days < 1) return setExtensionError('Days must be at least 1.');
    extensionMutation.mutate({ parcelId: extensionModal.id, reason: extensionForm.reason.trim(), requestedDays: days });
  };

  const pending = parcels.filter((p) => p.status === 'PENDING');
  const collected = parcels.filter((p) => p.status === 'COLLECTED');
  const expired = parcels.filter((p) => p.status === 'EXPIRED');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto p-6 space-y-8">

        {/* Scan status toast */}
        {scanStatus && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            scanStatus === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {scanMessage}
          </div>
        )}

        {/* Extension success toast */}
        {extensionSuccess && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-orange-500 text-white">
            Extension request submitted — awaiting admin approval.
          </div>
        )}

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
                  onScanQR={() => setScannerOpen(true)}
                  onRequestExtension={(parcel) => {
                    setExtensionModal(parcel);
                    setExtensionForm({ reason: '', days: '' });
                    setExtensionError('');
                  }}
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

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <QRScannerModal
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Extension Request Modal */}
      {extensionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-1">Request Extension</h3>
            <p className="text-sm text-gray-500 mb-4">
              Parcel <span className="font-mono font-medium">#{extensionModal.trackingNumber}</span>
            </p>
            <form onSubmit={handleExtensionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reason for extension
                </label>
                <textarea
                  value={extensionForm.reason}
                  onChange={(e) => setExtensionForm((f) => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  placeholder="e.g. I'm travelling and can't collect until next week..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  How many extra days do you need?
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={extensionForm.days}
                  onChange={(e) => setExtensionForm((f) => ({ ...f, days: e.target.value }))}
                  placeholder="e.g. 7"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {extensionError && (
                <p className="text-red-600 text-xs">{extensionError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={extensionMutation.isPending}
                  className="flex-1 bg-orange-500 text-white text-sm py-2 rounded hover:bg-orange-600 disabled:opacity-50"
                >
                  {extensionMutation.isPending ? 'Submitting…' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setExtensionModal(null)}
                  className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
