"use client";

import { useState } from 'react';
import { toast } from 'sonner';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateChannelModal({ isOpen, onClose, onSuccess }: CreateChannelModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    project_name: '',
    description: '',
    geometry_type: 'POINT_RADIUS',
    latitude: '',
    longitude: '',
    radius: '100',
    geometry: ''
  });

  const [dmsInput, setDmsInput] = useState('');

  if (!isOpen) return null;

  const handleDmsChange = (val: string) => {
    setDmsInput(val);
    if (!val.trim()) return;

    // Simple regex to match: 15°48'10.07"N or 74°34'48.92"E
    const regex = /(\d+)[^\d\w]*(\d+)[^\d\w]*([\d.]+)[^\d\w]*([NSEW])/gi;
    let lat: number | null = null;
    let lng: number | null = null;
    let match;

    while ((match = regex.exec(val)) !== null) {
      const d = parseFloat(match[1]);
      const m = parseFloat(match[2]);
      const s = parseFloat(match[3]);
      const dir = match[4].toUpperCase();

      let decimal = d + (m / 60) + (s / 3600);
      if (dir === 'S' || dir === 'W') {
        decimal = decimal * -1;
      }

      if (dir === 'N' || dir === 'S') {
        lat = decimal;
      } else if (dir === 'E' || dir === 'W') {
        lng = decimal;
      }
    }

    setForm(prev => ({
      ...prev,
      latitude: lat !== null ? lat.toFixed(6) : prev.latitude,
      longitude: lng !== null ? lng.toFixed(6) : prev.longitude,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload: any = {
        name: form.name,
        code: form.code,
        project_name: form.project_name || null,
        description: form.description || null,
        geometry_type: form.geometry_type,
      };

      if (form.geometry_type === 'POINT_RADIUS') {
        payload.latitude = parseFloat(form.latitude);
        payload.longitude = parseFloat(form.longitude);
        payload.radius = parseFloat(form.radius);
        
        if (isNaN(payload.latitude) || isNaN(payload.longitude)) {
          throw new Error('Valid latitude and longitude are required');
        }
      } else {
        payload.geometry = form.geometry;
        if (!payload.geometry) {
          throw new Error('Polygon WKT geometry is required');
        }
      }

      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create channel');

      toast.success('Channel created successfully');
      setForm({
        name: '', code: '', project_name: '', description: '',
        geometry_type: 'POINT_RADIUS', latitude: '', longitude: '', radius: '100', geometry: ''
      });
      setDmsInput('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <h2 className="text-xl font-bold text-gray-900">Add New Channel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-2">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Channel Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-xl px-4 py-2" placeholder="Main Gate" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Channel Code *</label>
              <input type="text" required value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="w-full border rounded-xl px-4 py-2 uppercase" placeholder="CH-001" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Project / Site Name (Optional)</label>
            <input type="text" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} className="w-full border rounded-xl px-4 py-2" placeholder="DHD Infra Phase 1" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Geometry Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="geom" checked={form.geometry_type === 'POINT_RADIUS'} onChange={() => setForm({...form, geometry_type: 'POINT_RADIUS'})} />
                <span className="text-sm font-medium">Point + Radius</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="geom" checked={form.geometry_type === 'POLYGON'} onChange={() => setForm({...form, geometry_type: 'POLYGON'})} />
                <span className="text-sm font-medium">Polygon WKT</span>
              </label>
            </div>
          </div>

          {form.geometry_type === 'POINT_RADIUS' ? (
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Auto-convert DMS Coordinates (Optional)</label>
                <input 
                  type="text" 
                  value={dmsInput} 
                  onChange={e => handleDmsChange(e.target.value)} 
                  className="w-full border rounded-xl px-4 py-2 text-sm bg-white" 
                  placeholder={`e.g. 15°48'10.07"N 74°34'48.92"E`} 
                />
                <p className="text-[10px] text-gray-500">Paste coordinates in Degrees, Minutes, Seconds format to auto-fill latitude and longitude below.</p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Latitude *</label>
                  <input type="number" step="any" required value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="28.6139" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Longitude *</label>
                  <input type="number" step="any" required value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="77.2090" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Radius (m) *</label>
                  <input type="number" required value={form.radius} onChange={e => setForm({...form, radius: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="100" />
                </div>
              </div>
            </div>
          ) : (
             <div className="space-y-1.5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <label className="text-sm font-bold text-gray-700">WKT Polygon</label>
                <textarea required value={form.geometry} onChange={e => setForm({...form, geometry: e.target.value})} rows={3} className="w-full border rounded-xl px-4 py-2 font-mono text-xs" placeholder="POLYGON((lng lat, lng lat, ...))" />
             </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-5 py-2.5 font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isLoading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
