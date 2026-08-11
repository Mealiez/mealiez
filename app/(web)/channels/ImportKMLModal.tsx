"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { parseKML, KMLPlacemark } from '@/lib/kml';

interface ImportKMLModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportKMLModal({ isOpen, onClose, onSuccess }: ImportKMLModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedChannels, setParsedChannels] = useState<KMLPlacemark[]>([]);
  const [projectName, setProjectName] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseKML(text);
        setParsedChannels(result);
        if (result.length === 0) {
          toast.error("No valid Placemarks found in KML file.");
        }
      } catch (err: any) {
        toast.error("Failed to parse KML file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validChannels = parsedChannels.filter(c => c.isValid);
    if (validChannels.length === 0) {
      toast.error("No valid channels to import.");
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validChannels.length; i++) {
      const c = validChannels[i];
      try {
        const payload: any = {
          name: c.name,
          code: `KML-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          project_name: projectName || null,
          geometry_type: c.geometry_type,
        };

        if (c.geometry_type === 'POINT_RADIUS') {
          payload.latitude = c.latitude;
          payload.longitude = c.longitude;
          payload.radius = 150; // Default KML point radius
        } else {
          payload.geometry = c.geometry;
        }

        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (e) {
        errorCount++;
      }
    }

    setIsProcessing(false);
    toast.success(`Import complete: ${successCount} imported, ${errorCount} failed.`);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Import from KML</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-2">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Assign Project / Site (Optional)</label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full border rounded-xl px-4 py-2" placeholder="e.g. Phase 2 Works" />
            <p className="text-xs text-gray-500 mt-1">All imported channels will be assigned to this project name.</p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
            <input type="file" accept=".kml" onChange={handleFileUpload} className="hidden" id="kml-upload" />
            <label htmlFor="kml-upload" className="cursor-pointer flex flex-col items-center">
              <span className="text-3xl mb-2">🗺️</span>
              <span className="text-sm font-bold text-indigo-600">Click to select KML file</span>
              <span className="text-xs text-gray-500 mt-1">Extracts Points and Polygons</span>
            </label>
          </div>

          {parsedChannels.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-900">Preview ({parsedChannels.filter(c => c.isValid).length} valid)</h3>
              <div className="bg-white border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 font-bold text-gray-500">Name</th>
                      <th className="p-3 font-bold text-gray-500">Type</th>
                      <th className="p-3 font-bold text-gray-500 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedChannels.map((c, i) => (
                      <tr key={i}>
                        <td className="p-3 font-medium">{c.name}</td>
                        <td className="p-3 text-gray-500">{c.geometry_type}</td>
                        <td className="p-3 text-right">
                          {c.isValid ? (
                            <span className="text-green-600 font-bold text-xs">Valid</span>
                          ) : (
                            <span className="text-red-600 text-xs" title={c.error}>Invalid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 flex justify-end gap-3 border-t border-gray-100 bg-gray-50 rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
          <button 
            onClick={handleImport} 
            disabled={isProcessing || parsedChannels.filter(c => c.isValid).length === 0} 
            className="px-5 py-2.5 font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Importing...' : 'Import Channels'}
          </button>
        </div>
      </div>
    </div>
  );
}
