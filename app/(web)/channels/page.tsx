import { Metadata } from 'next'
import ChannelManagementContent from './ChannelManagementContent'

export const metadata: Metadata = {
  title: 'Channel Management | Mealiez',
  description: 'Manage GPS-based work channels.',
}

export default function ChannelsPage() {
  return <ChannelManagementContent />
}
