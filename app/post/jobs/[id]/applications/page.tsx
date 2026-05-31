import JobApplicationsClient from './JobApplicationsClient'

type PageProps = {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}

export default function JobApplicationsPage({ params, searchParams }: PageProps) {
  const applicationValue = searchParams?.application
  const selectedApplicationId = Array.isArray(applicationValue) ? applicationValue[0] || '' : applicationValue || ''

  return <JobApplicationsClient id={params.id} initialSelectedApplicationId={selectedApplicationId} />
}
