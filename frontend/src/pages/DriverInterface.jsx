import { useState, useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Navbar from '../components/Navbar.jsx';
import api from '../lib/api.js';

function BarcodeScannerModal({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-reader',
      {
        fps: 15,
        qrbox: { width: 300, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      },
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
        <h3 className="font-semibold text-gray-800 mb-1">Scan Parcel Barcode</h3>
        <p className="text-sm text-gray-500 mb-4">Point your camera at the barcode on the parcel</p>
        <div id="barcode-reader" />
        <button
          onClick={onClose}
          className="mt-4 w-full border border-gray-300 text-gray-600 text-sm py-2 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function DriverInterface() {
  const [search, setSearch] = useState('');
  const [residents, setResidents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function handleSearch(e) {
    const value = e.target.value;
    setSearch(value);
    setSelected(null);
    if (value.length < 2) { setResidents([]); return; }
    try {
      const { data } = await api.get(`/users?role=RESIDENT&search=${encodeURIComponent(value)}`);
      setResidents(data);
    } catch {
      setResidents([]);
    }
  }

  function selectResident(r) {
    setSelected(r);
    setSearch(r.name);
    setResidents([]);
  }

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
  }

  function handleBarcodeScan(value) {
    setTrackingNumber(value);
    setScannerOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected) { setError('Please select a resident from the list'); return; }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('residentId', selected.id);
      formData.append('trackingNumber', trackingNumber);
      if (photo) formData.append('photo', photo);

      await api.post('/parcels', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      setSearch('');
      setSelected(null);
      setTrackingNumber('');
      setPhoto(null);
      setPreview(null);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log parcel');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Log New Parcel</h1>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded p-3 mb-4 text-sm">
            Parcel logged! Resident has been notified.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Resident search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Resident Name</label>
            <input
              type="text" value={search} onChange={handleSearch}
              placeholder="Start typing a name…"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {residents.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow mt-1">
                {residents.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => selectResident(r)}
                    className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                  >
                    <span className="font-medium">{r.name}</span>{' '}
                    <span className="text-gray-500 text-xs">{r.email}</span>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <p className="text-xs text-green-600 mt-1">Selected: {selected.name} ({selected.email})</p>
            )}
          </div>

          {/* Tracking number + scan button */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tracking / Parcel Number</label>
            <div className="flex gap-2">
              <input
                type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                required placeholder="e.g. JD000123456789"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="shrink-0 bg-gray-100 border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 flex items-center gap-1.5"
                title="Scan barcode"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 00-1 1v3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h1m2 0h1m2 0h1M7 12h1m2 0h1m2 0h1M7 16h1m2 0h1m2 0h1" />
                </svg>
                Scan
              </button>
            </div>
            {trackingNumber && (
              <p className="text-xs text-green-600 mt-1">Tracking number: {trackingNumber}</p>
            )}
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parcel Photo <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            {preview ? (
              <div className="relative inline-block w-full">
                <img src={preview} alt="Parcel preview" className="w-full max-h-48 object-cover rounded border border-gray-200" />
                <button
                  type="button" onClick={removePhoto}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <span className="text-2xl mb-1">📷</span>
                <span className="text-sm text-gray-500">Click to attach a photo</span>
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </label>
            )}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Logging…' : 'Log Parcel'}
          </button>
        </form>
      </div>

      {scannerOpen && (
        <BarcodeScannerModal
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
