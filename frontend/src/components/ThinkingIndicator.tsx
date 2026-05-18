interface Props {
  activeTools: string[]
}

export default function ThinkingIndicator({ activeTools }: Props) {
  if (activeTools.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {activeTools.map(tool => (
        <span
          key={tool}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 px-3 py-1 text-xs font-medium text-blue-300"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          {formatToolName(tool)}
        </span>
      ))}
    </div>
  )
}

function formatToolName(name: string): string {
  if (name.includes('cloudwatch')) return 'Checking CloudWatch…'
  if (name.includes('cloudtrail')) return 'Reading CloudTrail…'
  if (name.includes('cost') || name.includes('billing')) return 'Analyzing costs…'
  if (name.includes('iam')) return 'Auditing IAM…'
  if (name.includes('ec2')) return 'Querying EC2…'
  if (name.includes('rds')) return 'Checking RDS…'
  if (name.includes('lambda')) return 'Scanning Lambda…'
  if (name.includes('ecs')) return 'Inspecting ECS…'
  if (name.includes('security') || name.includes('hub')) return 'Checking Security Hub…'
  return `Calling ${name}…`
}
