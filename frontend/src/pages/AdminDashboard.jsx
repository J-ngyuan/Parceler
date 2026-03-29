import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import Navbar from '../components/Navbar.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import api from '../lib/api.js';

const socket = io('http://localhost:3000');

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('parcels'); // 'parcels' | 'extensions'
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'DRIVER' });
  const [createError, setCreateError] = useState('');
  const [qrModal, setQrModal] = useState(null); // { qrDataUrl, trackingNumber } or null
  const [rejectModal, setRejectModal] = useState(null); // extension request object or null
  const [rejectNote, setRejectNote] = useState('');

  // Real-time updates
  useEffect(() => {
    socket.on('parcel:new', () => {
      qc.invalidateQueries(['admin-parcels']);
      qc.invalidateQueries(['extension-requests']);
    });
    socket.on('parcel:collected', () => {
      qc.invalidateQueries(['admin-parcels']);
    });
    return () => {
      socket.off('parcel:new');
      socket.off('parcel:collected');
    };
  }, [qc]);

  const { data: parcels = [], isLoading } = useQuery({
    queryKey: ['admin-parcels', statusFilter],
    queryFn: () =>
      api.get(`/parcels${statusFilter ? `?status=${statusFilter}` : ''}`).then((r) => r.data),
  });

  const { data: extensionRequests = [], isLoading: extensionsLoading } = useQuery({
    queryKey: ['extension-requests'],
    queryFn: () => api.get('/parcels/extension-requests').then((r) => r.data),
  });

  const pendingExtensions = extensionRequests.filter((r) => r.status === 'PENDING');

  const collectMutation = useMutation({
    mutationFn: (id) => api.patch(`/parcels/${id}/collect`),
    onSuccess: () => qc.invalidateQueries(['admin-parcels']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/parcels/${id}`),
    onSuccess: () => qc.invalidateQueries(['admin-parcels']),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, days }) => api.patch(`/parcels/${id}/extend`, { days }),
    onSuccess: () => qc.invalidateQueries(['admin-parcels']),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId) => api.patch(`/parcels/extension-requests/${requestId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries(['extension-requests']);
      qc.invalidateQueries(['admin-parcels']);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, adminNote }) =>
      api.patch(`/parcels/extension-requests/${requestId}/reject`, { adminNote }),
    onSuccess: () => {
      qc.invalidateQueries(['extension-requests']);
      setRejectModal(null);
      setRejectNote('');
    },
  });

  async function handleShowQR(parcelId) {
    try {
      const { data } = await api.get(`/parcels/${parcelId}/qr`);
      setQrModal(data);
    } catch (err) {
      alert('Failed to load QR code');
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError('');
    try {
      await api.post('/users', newUser);
      setShowCreateUser(false);
      setNewUser({ name: '', email: '', password: '', role: 'DRIVER' });
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user');
    }
  }

  const stats = {
    total: parcels.length,
    pending: parcels.filter((p) => p.status === 'PENDING').length,
    collected: parcels.filter((p) => p.status === 'COLLECTED').length,
    expired: parcels.filter((p) => p.status === 'EXPIRED').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          <button
            onClick={() => setShowCreateUser(!showCreateUser)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            + Create User
          </button>
        </div>

        {/* Create user form */}
        {showCreateUser && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Create Driver / Admin Account</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', name: 'name', type: 'text' },
                { label: 'Email', name: 'email', type: 'email' },
                { label: 'Password', name: 'password', type: 'password' },
              ].map(({ label, name, type }) => (
                <div key={name}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type} value={newUser[name]}
                    onChange={(e) => setNewUser((u) => ({ ...u, [name]: e.target.value }))}
                    required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="DRIVER">Driver</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {createError && <p className="col-span-2 text-red-600 text-xs">{createError}</p>}
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700">
                  Create
                </button>
                <button type="button" onClick={() => setShowCreateUser(false)} className="text-gray-600 px-4 py-1.5 text-sm hover:underline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-700' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Collected', value: stats.collected, color: 'text-green-600' },
            { label: 'Expired', value: stats.expired, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('parcels')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'parcels'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Parcels
          </button>
          <button
            onClick={() => setActiveTab('extensions')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'extensions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Extension Requests
            {pendingExtensions.length > 0 && (
              <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingExtensions.length}
              </span>
            )}
          </button>
        </div>

        {/* Parcels Tab */}
        {activeTab === 'parcels' && (
          <>
            {/* Filter */}
            <div className="flex gap-2">
              {['', 'PENDING', 'COLLECTED', 'EXPIRED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-sm px-3 py-1 rounded-full border ${
                    statusFilter === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>

            {/* Parcels table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {isLoading ? (
                <p className="text-gray-400 text-sm p-6">Loading…</p>
              ) : parcels.length === 0 ? (
                <p className="text-gray-400 text-sm p-6">No parcels found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Tracking #', 'Resident', 'Delivered', 'Time Left', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parcels.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">{p.trackingNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{p.resident?.name}</p>
                          <p className="text-xs text-gray-500">{p.resident?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {format(new Date(p.deliveredAt), 'dd MMM, HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <CountdownTimer expiresAt={p.expiresAt} status={p.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            p.status === 'COLLECTED' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => handleShowQR(p.id)}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              QR
                            </button>
                            {p.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => collectMutation.mutate(p.id)}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                                >
                                  Collect
                                </button>
                                <button
                                  onClick={() => extendMutation.mutate({ id: p.id, days: 7 })}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                >
                                  +7 days
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => { if (confirm('Delete this parcel?')) deleteMutation.mutate(p.id); }}
                              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Extension Requests Tab */}
        {activeTab === 'extensions' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {extensionsLoading ? (
              <p className="text-gray-400 text-sm p-6">Loading…</p>
            ) : extensionRequests.length === 0 ? (
              <p className="text-gray-400 text-sm p-6">No extension requests yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Resident', 'Parcel', 'Reason', 'Days Requested', 'Submitted', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {extensionRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{r.resident?.name}</p>
                        <p className="text-xs text-gray-500">{r.resident?.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        #{r.parcel?.trackingNumber}
                        <p className={`text-xs font-sans mt-0.5 ${
                          r.parcel?.status === 'PENDING' ? 'text-yellow-600' :
                          r.parcel?.status === 'COLLECTED' ? 'text-green-600' : 'text-red-600'
                        }`}>{r.parcel?.status}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs">
                        <p className="text-xs leading-relaxed line-clamp-2">{r.reason}</p>
                        {r.adminNote && (
                          <p className="text-xs text-gray-400 mt-1 italic">Note: {r.adminNote}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        +{r.requestedDays}d
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {format(new Date(r.createdAt), 'dd MMM, HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          r.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveMutation.mutate(r.id)}
                              disabled={approveMutation.isPending}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setRejectModal(r); setRejectNote(''); }}
                              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs text-center">
            <h3 className="font-semibold text-gray-800 mb-1">QR Code</h3>
            <p className="text-sm text-gray-500 mb-4">
              Parcel <span className="font-mono font-medium">#{qrModal.trackingNumber}</span>
            </p>
            <img src={qrModal.qrDataUrl} alt="QR Code" className="mx-auto w-56 h-56" />
            <p className="text-xs text-gray-400 mt-3">Print and attach this to the parcel</p>
            <button
              onClick={() => setQrModal(null)}
              className="mt-4 w-full border border-gray-300 text-gray-600 text-sm py-2 rounded hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-1">Reject Extension Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              From <span className="font-medium">{rejectModal.resident?.name}</span> — +{rejectModal.requestedDays} days
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason for rejection <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                placeholder="e.g. Please collect as soon as possible..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => rejectMutation.mutate({ requestId: rejectModal.id, adminNote: rejectNote })}
                disabled={rejectMutation.isPending}
                className="flex-1 bg-red-600 text-white text-sm py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
