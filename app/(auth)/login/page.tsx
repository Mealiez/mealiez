import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return <LoginForm />
}
