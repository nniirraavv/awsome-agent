interface Props {
  services: string[]
}

export default function ServiceBadges({ services }: Props) {
  if (services.length === 0) return null

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Connected services</p>
      <div className="flex flex-wrap gap-1.5">
        {services.map(s => (
          <span
            key={s}
            className="rounded-md bg-gray-800 px-2 py-0.5 font-mono text-xs text-orange-300"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
