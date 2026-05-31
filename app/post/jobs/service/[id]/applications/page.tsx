import ServiceApplicationsClient from './ServiceApplicationsClient'

type PageProps = {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}

export default function ServiceApplicationsPage({ params, searchParams }: PageProps) {
  const applicationValue = searchParams?.application
  const selectedApplicationId = Array.isArray(applicationValue) ? applicationValue[0] || '' : applicationValue || ''

  return <ServiceApplicationsClient id={params.id} initialSelectedApplicationId={selectedApplicationId} />
}
