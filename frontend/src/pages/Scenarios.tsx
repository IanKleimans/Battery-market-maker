import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { api } from '@/api/client'
import { Card, Skeleton, Badge } from '@/components/ui'
import { usePageMeta } from '@/hooks/usePageMeta'

export function Scenarios() {
  usePageMeta({
    title: 'Scenarios',
    description:
      '10 pre-built configurations demonstrating wind curtailment, AI-campus dispatch, congested corridors, and forecast stress tests.',
  })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['scenarios'],
    queryFn: api.listScenarios,
  })

  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-1">Scenarios</h1>
        <p className="text-sm text-text-2 mt-1">
          Pre-built configurations that demonstrate different system behaviors —
          one-click load into the Pro simulator.
        </p>
      </div>

      {isError && (
        <Card>
          <p className="text-sm text-danger">
            Couldn't load scenarios. Make sure the backend is running on port 8000.
          </p>
        </Card>
      )}

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))}
        </div>
      )}

      {data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.3 }}
            >
              <Link
                to={`/simulator/pro?scenario=${s.id}`}
                className="block group"
              >
                <Card className="h-full group-hover:border-accent group-hover:shadow-card-hover transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <Badge tone="accent">{s.network}</Badge>
                    <ArrowRight
                      size={14}
                      className="text-text-2 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-text-1 mb-1">
                    {s.title}
                  </h3>
                  <p className="text-xs text-text-2 leading-relaxed">
                    {s.short_description}
                  </p>
                  {s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {s.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] text-text-2 mono px-1.5 py-0.5 bg-bg rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
