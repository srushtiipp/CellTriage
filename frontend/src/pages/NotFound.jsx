import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { role } = useAuth()
  const home = role === 'admin' ? '/fleet' : '/'
  const label = role === 'admin' ? 'Back to Fleet Overview' : 'Back to the Command Center'

  return (
    <div className="space-y-5">
      <PageHeader title="Page not found" />
      <Card className="p-6 text-[13px] text-text-secondary">
        There is nothing at this address.{' '}
        <Link to={home} className="font-medium text-accent-strong hover:underline">
          {label}
        </Link>
      </Card>
    </div>
  )
}
