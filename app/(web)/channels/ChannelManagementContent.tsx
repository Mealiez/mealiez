"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import CreateChannelModal from './CreateChannelModal';
import ImportKMLModal from './ImportKMLModal';

interface Channel {
  id: string;
  name: string;
  code: string;
  project_name?: string | null;
  geometry_type: string;
  is_active: boolean;
  created_at: string;
}

export default function ChannelManagementContent() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/channels?page=${page}&limit=${limit}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch channels');
      setChannels(data.data || []);
      setTotalCount(data.count || 0);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [page]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete channel');
      
      toast.success('Channel deleted successfully');
      fetchChannels();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3 uppercase">
            <span className="text-indigo-600">📍</span> Channel Management
            {!isLoading && totalCount > 0 && (
              <span className="bg-gray-100 text-gray-600 text-sm font-bold px-3 py-1 rounded-full">{totalCount} Total</span>
            )}
          </h1>
          <p className="text-gray-500 font-medium text-sm mt-1 uppercase tracking-widest">
            Manage GPS-based work zones and locations.
          </p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsImportOpen(true)} className="px-4 py-2 bg-white text-gray-700 border rounded-lg shadow-sm text-sm font-semibold hover:bg-gray-50 transition-colors">Import KML</button>
            <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm text-sm font-semibold hover:bg-indigo-700 transition-colors">+ Add Channel</button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 animate-pulse">
          <div className="h-64 bg-gray-100 rounded-3xl" />
        </div>
      ) : channels.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Channel</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Project / Site</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {channels.map(channel => (
                  <tr key={channel.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900">{channel.name}</div>
                      <div className="text-xs text-gray-500">{channel.code}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">{channel.project_name || '—'}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{channel.geometry_type === 'POINT_RADIUS' ? 'Point + Radius' : 'Polygon'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${channel.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {channel.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => handleDelete(channel.id)} className="text-red-600 hover:text-red-900 text-sm font-semibold">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalCount > limit && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white">
                <div className="text-sm text-gray-500 font-medium">
                  Showing <span className="font-bold text-gray-900">{(page - 1) * limit + 1}</span> to <span className="font-bold text-gray-900">{Math.min(page * limit, totalCount)}</span> of <span className="font-bold text-gray-900">{totalCount}</span> results
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= totalCount}
                    className="px-3 py-1.5 border rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center space-y-4">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
            <span className="text-4xl">📍</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">No Channels Yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-2 font-medium">
              Start by adding your first GPS work channel. You can then assign members and track location-based attendance.
            </p>
          </div>
        </div>
      )}

      <CreateChannelModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={fetchChannels} />
      <ImportKMLModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={fetchChannels} />
    </div>
  );
}
