import { branding } from '@/config/branding'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to {branding.name}</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
        {branding.tagline}
      </p>
    </main>
  )
}
