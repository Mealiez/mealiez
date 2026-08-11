"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Camera, 
  Loader2, 
  ShieldCheck,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyProfilePage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSubmitting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form States
  const [personalInfo, setPersonalInfo] = useState({ full_name: '', phone: '', avatar_url: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [emailForm, setEmailForm] = useState({ new_email: '', otp: '', step: 'request' }); // 'request' or 'verify'

  const fetchProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('users')
        .select('*, tenants(name), designation:designations(name), branch:branches(name), channel:channels(name)')
        .eq('auth_id', authUser.id)
        .single();

      const combined = { ...profile, email: authUser.email };
      setUser(combined);
      setPersonalInfo({ 
        full_name: profile.full_name, 
        phone: profile.phone || '', 
        avatar_url: profile.avatar_url || '' 
      });
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatar')
        .getPublicUrl(filePath);

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl })
      });

      if (!res.ok) throw new Error('Failed to update profile');
      
      setPersonalInfo(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('Avatar updated!');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const updatePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting('personal');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: personalInfo.full_name,
          phone: personalInfo.phone
        })
      });

      if (!res.ok) throw new Error('Update failed');
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setIsSubmitting(null);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      return toast.error('Passwords do not match');
    }

    setIsSubmitting('password');
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.new
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');

      toast.success('Password changed successfully');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  const requestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting('email_request');
    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: emailForm.new_email })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setEmailForm(prev => ({ ...prev, step: 'verify' }));
      toast.success('Verification code sent!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  const verifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting('email_verify');
    try {
      const res = await fetch('/api/profile/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForm.new_email,
          token: emailForm.otp
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      toast.success('Email updated successfully!');
      setUser((prev: any) => ({ ...prev, email: emailForm.new_email }));
      setEmailForm({ new_email: '', otp: '', step: 'request' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-gray-100">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="h-24 w-24 rounded-3xl bg-blue-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden transition-all group-hover:scale-105">
               {personalInfo.avatar_url ? (
                 <img src={personalInfo.avatar_url} alt="Profile" className="h-full w-full object-cover" />
               ) : (
                 <span className="text-4xl font-black text-blue-600 uppercase">{user.full_name.charAt(0)}</span>
               )}
               {isUploading && (
                 <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600" size={20} />
                 </div>
               )}
            </div>
            <label className="absolute -bottom-2 -right-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
              <Camera size={16} />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
            </label>
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-none">{user.full_name}</h1>
            <div className="flex items-center gap-3 mt-3">
               <Badge variant="outline" className="font-black uppercase text-[10px] tracking-widest px-3 py-1 bg-gray-50 border-gray-200">
                 {user.role}
               </Badge>
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{user.tenants?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <Card className="border-none shadow-2xl shadow-blue-500/5 rounded-[2rem] overflow-hidden">
             <CardHeader className="bg-gray-50/50 border-b border-gray-50 px-8 py-6">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <User size={18} className="text-blue-600" />
                  Personal Information
                </CardTitle>
                <CardDescription className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Manage your basic profile details</CardDescription>
             </CardHeader>
             <CardContent className="p-8">
                <form onSubmit={updatePersonalInfo} className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</Label>
                        <Input 
                          value={personalInfo.full_name} 
                          onChange={e => setPersonalInfo({...personalInfo, full_name: e.target.value})}
                          className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</Label>
                        <Input 
                          value={personalInfo.phone} 
                          onChange={e => setPersonalInfo({...personalInfo, phone: e.target.value})}
                          placeholder="e.g. +91 98765 43210"
                          className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Branch</Label>
                        <Input 
                          value={user.branch?.name || 'Unassigned'} 
                          readOnly
                          className="rounded-xl border-gray-100 bg-gray-100 font-bold h-11 cursor-not-allowed opacity-75"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Channel</Label>
                        <Input 
                          value={user.channel?.name || 'Unassigned'} 
                          readOnly
                          className="rounded-xl border-gray-100 bg-gray-100 font-bold h-11 cursor-not-allowed opacity-75"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Designation</Label>
                        <Input 
                          value={user.designation?.name || 'Not Set'} 
                          readOnly
                          className="rounded-xl border-gray-100 bg-gray-100 font-bold h-11 cursor-not-allowed opacity-75"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enrollment No.</Label>
                        <Input 
                          value={user.enrollment_no || 'N/A'} 
                          readOnly
                          className="rounded-xl border-gray-100 bg-gray-100 font-bold h-11 cursor-not-allowed opacity-75"
                        />
                      </div>
                   </div>
                   <div className="flex justify-end pt-2">
                      <Button 
                        type="submit" 
                        disabled={isSaving === 'personal'}
                        className="bg-blue-600 hover:bg-blue-700 rounded-xl px-8 font-black uppercase text-xs tracking-widest"
                      >
                        {isSaving === 'personal' ? <Loader2 className="animate-spin mr-2" size={14} /> : 'Save Changes'}
                      </Button>
                   </div>
                </form>
             </CardContent>
          </Card>

          <Card className="border-none shadow-2xl shadow-blue-500/5 rounded-[2rem] overflow-hidden">
             <CardHeader className="bg-gray-50/50 border-b border-gray-50 px-8 py-6">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <Mail size={18} className="text-indigo-600" />
                  Email Address
                </CardTitle>
                <CardDescription className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Change your primary login email</CardDescription>
             </CardHeader>
             <CardContent className="p-8">
                <div className="mb-8 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Current Email</p>
                        <p className="text-sm font-black text-indigo-900">{user.email}</p>
                      </div>
                   </div>
                   <Badge className="bg-indigo-600 text-white font-black uppercase text-[8px] tracking-[0.2em] rounded-lg">Verified</Badge>
                </div>

                {emailForm.step === 'request' ? (
                  <form onSubmit={requestEmailChange} className="space-y-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Email Address</Label>
                        <div className="flex gap-4">
                           <Input 
                             type="email" 
                             required
                             placeholder="new.email@example.com"
                             value={emailForm.new_email}
                             onChange={e => setEmailForm({...emailForm, new_email: e.target.value})}
                             className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white"
                           />
                           <Button 
                             type="submit" 
                             disabled={isSaving === 'email_request'}
                             className="bg-gray-900 hover:bg-black rounded-xl font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                           >
                             {isSaving === 'email_request' ? <Loader2 className="animate-spin" size={14} /> : 'Send OTP'}
                           </Button>
                        </div>
                     </div>
                  </form>
                ) : (
                  <form onSubmit={verifyEmailChange} className="space-y-4">
                     <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3 mb-6">
                        <AlertCircle className="text-amber-600 shrink-0" size={18} />
                        <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-tight">
                          We've sent a code to <span className="underline">{emailForm.new_email}</span>. Please enter it below to confirm.
                        </p>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Verification OTP</Label>
                        <div className="flex gap-4">
                           <Input 
                             required
                             placeholder="Enter 6-digit code"
                             value={emailForm.otp}
                             onChange={e => setEmailForm({...emailForm, otp: e.target.value})}
                             className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white text-center tracking-[1em]"
                           />
                           <Button 
                             type="submit" 
                             disabled={isSaving === 'email_verify'}
                             className="bg-green-600 hover:bg-green-700 rounded-xl font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                           >
                             {isSaving === 'email_verify' ? <Loader2 className="animate-spin" size={14} /> : 'Verify & Update'}
                           </Button>
                        </div>
                     </div>
                     <button 
                       type="button" 
                       onClick={() => setEmailForm({...emailForm, step: 'request'})}
                       className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 underline ml-1"
                     >
                       Cancel and try another email
                     </button>
                  </form>
                )}
             </CardContent>
          </Card>
        </div>

        <div className="space-y-10">
          <Card className="border-none shadow-2xl shadow-blue-500/5 rounded-[2rem] overflow-hidden sticky top-8">
             <CardHeader className="bg-gray-50/50 border-b border-gray-50 px-8 py-6">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <KeyRound size={18} className="text-red-600" />
                  Security
                </CardTitle>
                <CardDescription className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Update your account password</CardDescription>
             </CardHeader>
             <CardContent className="p-8">
                <form onSubmit={updatePassword} className="space-y-5">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Password</Label>
                      <Input 
                        type="password" 
                        required
                        value={passwordForm.current}
                        onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                        className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Password</Label>
                      <Input 
                        type="password" 
                        required
                        minLength={8}
                        value={passwordForm.new}
                        onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                        className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Confirm New Password</Label>
                      <Input 
                        type="password" 
                        required
                        value={passwordForm.confirm}
                        onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                        className="rounded-xl border-gray-100 bg-gray-50/50 font-bold h-11 focus:bg-white"
                      />
                   </div>
                   <Button 
                      type="submit" 
                      disabled={isSaving === 'password'}
                      className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest py-6 shadow-lg shadow-red-500/10"
                   >
                      {isSaving === 'password' ? <Loader2 className="animate-spin mr-2" size={14} /> : 'Update Password'}
                   </Button>
                </form>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
