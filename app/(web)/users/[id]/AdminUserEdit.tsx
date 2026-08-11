"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface AdminUserEditProps {
  userId: string
  initialBranchId: string | null
  initialChannelId: string | null
  initialDesignationId: string | null
  branches: { id: string, name: string }[]
  channels: { id: string, name: string }[]
  designations: { id: string, name: string }[]
}

export default function AdminUserEdit({
  userId,
  initialBranchId,
  initialChannelId,
  initialDesignationId,
  branches,
  channels,
  designations
}: AdminUserEditProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [branchId, setBranchId] = useState<string>(initialBranchId || 'none')
  const [channelId, setChannelId] = useState<string>(initialChannelId || 'none')
  const [designationId, setDesignationId] = useState<string>(initialDesignationId || 'none')

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId === 'none' ? null : branchId,
          channel_id: channelId === 'none' ? null : channelId,
          designation_id: designationId === 'none' ? null : designationId
        })
      })

      if (res.ok) {
        toast.success('User updated successfully')
        router.refresh()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Update failed')
      }
    } catch (err) {
      toast.error('An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = (branchId === 'none' ? null : branchId) !== initialBranchId || 
                     (channelId === 'none' ? null : channelId) !== initialChannelId ||
                     (designationId === 'none' ? null : designationId) !== initialDesignationId

  return (
    <div className="space-y-6 pt-4 border-t border-gray-100">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Change Branch</Label>
          <select 
            value={branchId} 
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-100 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
          >
            <option value="none">Unassigned / Global</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Change Channel</Label>
          <select 
            value={channelId} 
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-100 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
          >
            <option value="none">Unassigned</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Change Designation</Label>
          <select 
            value={designationId} 
            onChange={(e) => setDesignationId(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-100 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
          >
            <option value="none">Not Set</option>
            {designations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl px-8 font-black uppercase text-[10px] tracking-widest h-11 shadow-lg shadow-blue-500/10 transition-all"
        >
          {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Apply Updates
        </Button>
      </div>
    </div>
  )
}
