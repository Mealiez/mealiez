import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import RegisterForm from './RegisterForm'

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return <RegisterForm />
}
